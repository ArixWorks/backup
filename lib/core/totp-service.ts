import "server-only"
import { prisma } from "@/lib/db"
import { decryptSecret, encryptSecret } from "@/lib/ai/crypto"
import { DomainError, ForbiddenError, NotFoundError } from "./errors"
import { generateTotp, isValidBase32Secret, secondsRemaining } from "./totp"

/**
 * Service layer coupling the RFC 6238 primitives (lib/core/totp) to the
 * persistence + allowance model. A single shared credential (InventoryItem)
 * carries one encrypted TOTP secret; each recipient (an order Delivery or a
 * GiveawayWinner) tracks its own usage against `maxUses`, and may open a
 * re-request to earn bonus fetches once exhausted.
 */

export type TotpRecipient =
  | { kind: "delivery"; deliveryId: string }
  | { kind: "winner"; winnerId: string }

export interface TotpStatus {
  available: boolean
  used: number
  /** Total fetches allowed (maxUses + granted bonus). Null = unlimited. */
  limit: number | null
  remaining: number | null
  /** Latest re-request state for this recipient, if any. */
  reRequest: { status: "PENDING" | "APPROVED" | "REJECTED"; adminMessage: string | null } | null
}

/** Attach (or replace) the encrypted TOTP secret on an inventory item. */
export async function setInventoryTotpSecret(
  inventoryItemId: string,
  rawSecret: string,
  opts: { maxUses?: number | null; digits?: number; period?: number; algo?: string } = {},
) {
  if (!isValidBase32Secret(rawSecret)) {
    throw new DomainError("کلید ۲مرحله‌ای نامعتبر است (Base32 ≥ ۱۶ کاراکتر)", "INVALID_TOTP_SECRET", 422)
  }
  const secretEnc = encryptSecret(rawSecret.replace(/\s+/g, "").toUpperCase())
  const data = {
    secretEnc,
    maxUses: opts.maxUses ?? null,
    digits: opts.digits ?? 6,
    period: opts.period ?? 30,
    algo: opts.algo ?? "SHA1",
  }
  return prisma.totpSecret.upsert({
    where: { inventoryItemId },
    create: { inventoryItemId, ...data },
    update: data,
  })
}

export async function removeInventoryTotpSecret(inventoryItemId: string) {
  await prisma.totpSecret.deleteMany({ where: { inventoryItemId } })
}

/**
 * Resolve the TOTP secret backing a recipient and assert the caller owns it.
 * Returns null when the recipient's credential carries no 2FA secret.
 */
async function resolveSecretForRecipient(recipient: TotpRecipient, userId: string) {
  if (recipient.kind === "delivery") {
    const delivery = await prisma.delivery.findUnique({
      where: { id: recipient.deliveryId },
      select: {
        inventoryItemId: true,
        order: { select: { userId: true } },
        inventoryItem: { select: { totpSecret: true } },
      },
    })
    if (!delivery) throw new NotFoundError("تحویل یافت نشد")
    if (delivery.order.userId !== userId) throw new ForbiddenError()
    return delivery.inventoryItem?.totpSecret ?? null
  }
  const winner = await prisma.giveawayWinner.findUnique({
    where: { id: recipient.winnerId },
    select: { userId: true },
  })
  if (!winner) throw new NotFoundError("برنده یافت نشد")
  if (winner.userId !== userId) throw new ForbiddenError()
  // Giveaway winners reference their secret via the usage row's secret link,
  // established when the admin attaches a secret to the winner's credential.
  const usage = await prisma.totpUsage.findFirst({
    where: { winnerId: recipient.winnerId },
    select: { totpSecret: true },
  })
  return usage?.totpSecret ?? null
}

/** Fetch-or-create the per-recipient usage row for a secret. */
async function getOrCreateUsage(secretId: string, recipient: TotpRecipient, userId: string) {
  const where =
    recipient.kind === "delivery"
      ? { totpSecretId_deliveryId: { totpSecretId: secretId, deliveryId: recipient.deliveryId } }
      : { totpSecretId_winnerId: { totpSecretId: secretId, winnerId: recipient.winnerId } }
  const existing = await prisma.totpUsage.findUnique({ where }).catch(() => null)
  if (existing) return existing
  return prisma.totpUsage.create({
    data: {
      totpSecretId: secretId,
      userId,
      deliveryId: recipient.kind === "delivery" ? recipient.deliveryId : null,
      winnerId: recipient.kind === "winner" ? recipient.winnerId : null,
    },
  })
}

function computeLimit(maxUses: number | null, bonus: number): number | null {
  return maxUses == null ? null : maxUses + bonus
}

/** Report whether a recipient can still fetch a code, and their allowance. */
export async function getTotpStatus(recipient: TotpRecipient, userId: string): Promise<TotpStatus | null> {
  const secret = await resolveSecretForRecipient(recipient, userId)
  if (!secret) return null
  const usage = await getOrCreateUsage(secret.id, recipient, userId)
  const limit = computeLimit(secret.maxUses, usage.bonusUses)
  const remaining = limit == null ? null : Math.max(0, limit - usage.usedCount)
  const latest = await prisma.twoFactorReRequest.findFirst({
    where: { totpUsageId: usage.id },
    orderBy: { createdAt: "desc" },
    select: { status: true, adminMessage: true },
  })
  return {
    available: limit == null || usage.usedCount < limit,
    used: usage.usedCount,
    limit,
    remaining,
    reRequest: latest ? { status: latest.status, adminMessage: latest.adminMessage } : null,
  }
}

export interface IssuedTotp {
  code: string
  expiresInSec: number
  period: number
  remaining: number | null
}

/** Issue a fresh code for a recipient, enforcing (and consuming) allowance. */
export async function issueTotpCode(recipient: TotpRecipient, userId: string): Promise<IssuedTotp> {
  const secret = await resolveSecretForRecipient(recipient, userId)
  if (!secret) throw new NotFoundError("این اکانت کد دومرحله‌ای ندارد")

  // Atomically claim one use if a finite limit applies.
  const usage = await getOrCreateUsage(secret.id, recipient, userId)
  const limit = computeLimit(secret.maxUses, usage.bonusUses)

  if (limit != null) {
    const claimed = await prisma.totpUsage.updateMany({
      where: { id: usage.id, usedCount: { lt: limit } },
      data: { usedCount: { increment: 1 } },
    })
    if (claimed.count !== 1) {
      throw new DomainError(
        "سقف دریافت کد به پایان رسیده است. درخواست دریافت مجدد بدهید.",
        "TOTP_LIMIT_REACHED",
        429,
      )
    }
  }

  const code = generateTotp({
    secret: decryptSecret(secret.secretEnc),
    digits: secret.digits,
    period: secret.period,
    algo: secret.algo as "SHA1" | "SHA256" | "SHA512",
  })
  const remaining = limit == null ? null : Math.max(0, limit - (usage.usedCount + 1))
  return { code, expiresInSec: secondsRemaining(secret.period), period: secret.period, remaining }
}

/** Open a re-request for more fetches once the allowance is exhausted. */
export async function createReRequest(recipient: TotpRecipient, userId: string, reason: string) {
  const secret = await resolveSecretForRecipient(recipient, userId)
  if (!secret) throw new NotFoundError("این اکانت کد دومرحله‌ای ندارد")
  const usage = await getOrCreateUsage(secret.id, recipient, userId)

  const pending = await prisma.twoFactorReRequest.findFirst({
    where: { totpUsageId: usage.id, status: "PENDING" },
    select: { id: true },
  })
  if (pending) {
    throw new DomainError("یک درخواست در حال بررسی دارید.", "TOTP_REREQUEST_PENDING", 409)
  }
  return prisma.twoFactorReRequest.create({
    data: { totpUsageId: usage.id, userId, reason: reason.trim().slice(0, 500) },
  })
}

/** Admin: approve a re-request, granting bonus fetches to the recipient. */
export async function approveReRequest(reRequestId: string, grantedUses: number, adminMessage?: string) {
  const grant = Math.max(1, Math.floor(grantedUses) || 1)
  return prisma.$transaction(async (tx) => {
    const req = await tx.twoFactorReRequest.findUnique({
      where: { id: reRequestId },
      select: { id: true, status: true, totpUsageId: true },
    })
    if (!req) throw new NotFoundError("درخواست یافت نشد")
    if (req.status !== "PENDING") throw new DomainError("این درخواست قبلاً رسیدگی شده است.", "ALREADY_RESOLVED", 409)
    await tx.totpUsage.update({
      where: { id: req.totpUsageId },
      data: { bonusUses: { increment: grant } },
    })
    return tx.twoFactorReRequest.update({
      where: { id: reRequestId },
      data: {
        status: "APPROVED",
        grantedUses: grant,
        adminMessage: adminMessage?.trim().slice(0, 500) || null,
        resolvedAt: new Date(),
      },
    })
  })
}

/** Admin: reject a re-request with an optional message. */
export async function rejectReRequest(reRequestId: string, adminMessage?: string) {
  const req = await prisma.twoFactorReRequest.findUnique({
    where: { id: reRequestId },
    select: { status: true },
  })
  if (!req) throw new NotFoundError("درخواست یافت نشد")
  if (req.status !== "PENDING") throw new DomainError("این درخواست قبلاً رسیدگی شده است.", "ALREADY_RESOLVED", 409)
  return prisma.twoFactorReRequest.update({
    where: { id: reRequestId },
    data: {
      status: "REJECTED",
      adminMessage: adminMessage?.trim().slice(0, 500) || null,
      resolvedAt: new Date(),
    },
  })
}
