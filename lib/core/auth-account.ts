import "server-only"
import crypto from "node:crypto"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/core/audit"
import { hashPassword, verifyPassword } from "@/lib/auth/password"
import { ValidationError, ConflictError, NotFoundError, ForbiddenError } from "@/lib/core/errors"
import { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from "@/lib/email"
import type { TelegramUser } from "@/lib/telegram/verify"

/**
 * Account & identity management: linking Telegram and email/password to a
 * single user record, email verification, and password lifecycle. Every
 * security-sensitive action is written to the audit log.
 */

const TOKEN_TTL_MS = 30 * 60 * 1000 // 30 minutes
const MIN_PASSWORD = 8

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function newRawToken(): string {
  return crypto.randomBytes(32).toString("base64url")
}

/** Append an authentication audit record (login, link, password change, …). */
export async function recordAuthEvent(
  userId: string,
  action: string,
  meta?: Record<string, unknown>,
) {
  await audit({
    actorId: userId,
    action: `auth.${action}`,
    entity: "user",
    entityId: userId,
    meta: meta as never,
  })
}

// ---------------------------------------------------------------------------
// Account state (for Profile Settings UI)
// ---------------------------------------------------------------------------

export type AccountState = {
  telegram: { connected: boolean; username: string | null }
  email: { address: string | null; verified: boolean; pending: string | null }
  hasPassword: boolean
  lastLoginMethod: string | null
  mustChangePassword: boolean
  methods: string[]
}

export async function getAccountState(userId: string): Promise<AccountState> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new NotFoundError("کاربر یافت نشد")

  const pending = await prisma.authToken.findFirst({
    where: { userId, type: "EMAIL_VERIFY", usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  })

  const methods: string[] = []
  if (user.telegramId) methods.push("telegram")
  if (user.email && user.emailVerified && user.passwordHash) methods.push("password")

  return {
    telegram: { connected: !!user.telegramId, username: user.telegramUsername ?? null },
    email: {
      address: user.email ?? null,
      verified: user.emailVerified,
      pending: pending?.email ?? null,
    },
    hasPassword: !!user.passwordHash,
    lastLoginMethod: user.lastLoginMethod ?? null,
    mustChangePassword: user.mustChangePassword,
    methods,
  }
}

// ---------------------------------------------------------------------------
// Email verification (add email, or add email + password for Telegram users)
// ---------------------------------------------------------------------------

/**
 * Begin verifying an email for the current account. Optionally sets a password
 * at the same time (the "Add Email & Password" flow for Telegram-only users).
 * The email is NOT written to the user until the link is confirmed, so an
 * unverified address never becomes active or blocks anyone else.
 */
export async function startEmailVerification(input: {
  userId: string
  email: string
  password?: string
  origin: string
}) {
  const user = await prisma.user.findUnique({ where: { id: input.userId } })
  if (!user) throw new NotFoundError("کاربر یافت نشد")

  // A verified email is locked — changes must go through admin/recovery.
  if (user.email && user.emailVerified) {
    throw new ForbiddenError("ایمیل تأییدشده قابل تغییر نیست")
  }

  const email = input.email.toLowerCase().trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError("ایمیل نامعتبر است")

  // Prevent linking an email already used by another account.
  const taken = await prisma.user.findFirst({ where: { email, id: { not: user.id } } })
  if (taken) throw new ConflictError("این ایمیل قبلاً برای حساب دیگری ثبت شده است")

  if (input.password !== undefined) {
    if (input.password.length < MIN_PASSWORD) {
      throw new ValidationError("رمز عبور باید حداقل ۸ کاراکتر باشد")
    }
  }

  await prisma.$transaction(async (tx) => {
    // If a password was supplied, store it now (dormant until email verified).
    if (input.password !== undefined) {
      const passwordHash = await hashPassword(input.password)
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } })
    }
    // Invalidate previous pending verification tokens for this user.
    await tx.authToken.deleteMany({ where: { userId: user.id, type: "EMAIL_VERIFY", usedAt: null } })

    const raw = newRawToken()
    await tx.authToken.create({
      data: {
        userId: user.id,
        type: "EMAIL_VERIFY",
        tokenHash: sha256(raw),
        email,
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    })
    const link = `${input.origin}/account/verify-email?token=${raw}`
    await sendVerificationEmail({ to: email, userId: user.id, code: raw.slice(0, 8), verifyUrl: link })
  })

  await recordAuthEvent(user.id, "email.verify_requested", { email })
  return { ok: true }
}

/** Confirm an email verification token; activates and locks the email. */
export async function confirmEmail(rawToken: string) {
  const token = await prisma.authToken.findUnique({ where: { tokenHash: sha256(rawToken) } })
  if (!token || token.type !== "EMAIL_VERIFY" || token.usedAt || token.expiresAt < new Date()) {
    throw new ValidationError("لینک تأیید نامعتبر یا منقضی شده است")
  }
  if (!token.email) throw new ValidationError("لینک تأیید نامعتبر است")

  // Re-check uniqueness at confirm time (someone may have claimed it meanwhile).
  const taken = await prisma.user.findFirst({
    where: { email: token.email, id: { not: token.userId } },
  })
  if (taken) throw new ConflictError("این ایمیل قبلاً برای حساب دیگری ثبت شده است")

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: token.userId },
      data: { email: token.email, emailVerified: true },
    })
    await tx.authToken.update({ where: { id: token.id }, data: { usedAt: new Date() } })
  })
  await recordAuthEvent(token.userId, "email.verified", { email: token.email })
  // Onboarding: welcome the user now that their email is confirmed.
  await sendWelcomeEmail({ to: token.email, userId: token.userId })
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Password lifecycle
// ---------------------------------------------------------------------------

/** Change password for a logged-in user who already has one. */
export async function changePassword(input: {
  userId: string
  currentPassword: string
  newPassword: string
}) {
  const user = await prisma.user.findUnique({ where: { id: input.userId } })
  if (!user) throw new NotFoundError("کاربر یافت نشد")
  if (!user.passwordHash) throw new ValidationError("برای این حساب رمز عبوری تنظیم نشده است")
  if (input.newPassword.length < MIN_PASSWORD) {
    throw new ValidationError("رمز عبور جدید باید حداقل ۸ کاراکتر باشد")
  }
  const ok = await verifyPassword(input.currentPassword, user.passwordHash)
  if (!ok) throw new ForbiddenError("رمز عبور فعلی اشتباه است")

  const passwordHash = await hashPassword(input.newPassword)
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  })
  await recordAuthEvent(user.id, "password.changed")
  return { ok: true }
}

/** Start a password reset for a verified email. Always succeeds (no enumeration). */
export async function requestPasswordReset(emailInput: string, origin: string) {
  const email = emailInput.toLowerCase().trim()
  const user = await prisma.user.findFirst({ where: { email, emailVerified: true } })
  if (user) {
    await prisma.authToken.deleteMany({
      where: { userId: user.id, type: "PASSWORD_RESET", usedAt: null },
    })
    const raw = newRawToken()
    await prisma.authToken.create({
      data: {
        userId: user.id,
        type: "PASSWORD_RESET",
        tokenHash: sha256(raw),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    })
    const link = `${origin}/reset-password?token=${raw}`
    await sendPasswordResetEmail({ to: email, userId: user.id, resetUrl: link, code: raw.slice(0, 8) })
    await recordAuthEvent(user.id, "password.reset_requested")
  }
  return { ok: true }
}

/** Complete a password reset; invalidates all existing sessions. */
export async function resetPassword(rawToken: string, newPassword: string) {
  if (newPassword.length < MIN_PASSWORD) {
    throw new ValidationError("رمز عبور جدید باید حداقل ۸ کاراکتر باشد")
  }
  const token = await prisma.authToken.findUnique({ where: { tokenHash: sha256(rawToken) } })
  if (!token || token.type !== "PASSWORD_RESET" || token.usedAt || token.expiresAt < new Date()) {
    throw new ValidationError("لینک بازیابی نامعتبر یا منقضی شده است")
  }
  const passwordHash = await hashPassword(newPassword)
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: token.userId },
      data: { passwordHash, mustChangePassword: false, tokenVersion: { increment: 1 } },
    })
    await tx.authToken.update({ where: { id: token.id }, data: { usedAt: new Date() } })
  })
  await recordAuthEvent(token.userId, "password.reset")
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Telegram linking
// ---------------------------------------------------------------------------

/** Link a verified Telegram identity to the current account. */
export async function linkTelegram(userId: string, tg: TelegramUser) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new NotFoundError("کاربر یافت نشد")
  if (user.telegramId) throw new ConflictError("حساب تلگرام قبلاً متصل شده است")

  const telegramId = String(tg.id)
  // Prevent linking a Telegram account already connected to another user.
  const taken = await prisma.user.findFirst({
    where: { telegramId, id: { not: user.id } },
  })
  if (taken) throw new ConflictError("این حساب تلگرام به کاربر دیگری متصل است")

  await prisma.user.update({
    where: { id: user.id },
    data: {
      telegramId,
      telegramChatId: telegramId,
      telegramUsername: tg.username ?? null,
      photoUrl: user.photoUrl ?? tg.photo_url ?? null,
    },
  })
  await recordAuthEvent(user.id, "telegram.linked", { telegramId })
  return { ok: true }
}

/** Unlink Telegram. Requires a working email+password so the user keeps access. */
export async function unlinkTelegram(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new NotFoundError("کاربر یافت نشد")
  if (!user.telegramId) throw new ValidationError("حساب تلگرامی متصل نیست")
  if (!(user.email && user.emailVerified && user.passwordHash)) {
    throw new ForbiddenError("ابتدا ایمیل و رمز عبور تأییدشده اضافه کنید تا قطع اتصال ممکن شود")
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { telegramId: null, telegramChatId: null, telegramUsername: null },
  })
  await recordAuthEvent(user.id, "telegram.unlinked")
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/** Invalidate every issued session by bumping the token version. */
export async function logoutAllSessions(userId: string): Promise<number> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  })
  await recordAuthEvent(userId, "sessions.revoked_all")
  return user.tokenVersion
}
