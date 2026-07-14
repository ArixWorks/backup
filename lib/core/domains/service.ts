import "server-only"
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { ConflictError, NotFoundError, ValidationError } from "@/lib/core/errors"
import { getAllSettings, SETTING_KEYS, toNumber } from "@/lib/core/settings"
import { captureFrozenPurchase, freeze, unfreeze } from "@/lib/core/wallet"
import { lookupWithProvider, registerWithProvider } from "./provider"
import { normalizeDomain } from "./validation"

const DEFAULT_TLDS = [
  { tld: ".ir", title: "ایران", basePriceIrt: 75_000n, displayOrder: 1 },
  { tld: ".com", title: "تجاری", basePriceIrt: 890_000n, displayOrder: 2 },
  { tld: ".net", title: "شبکه", basePriceIrt: 980_000n, displayOrder: 3 },
  { tld: ".org", title: "سازمانی", basePriceIrt: 920_000n, displayOrder: 4 },
  { tld: ".shop", title: "فروشگاه", basePriceIrt: 1_150_000n, displayOrder: 5 },
]

async function ensureDefaultTlds() {
  if (await prisma.domainTld.count()) return
  await prisma.domainTld.createMany({ data: DEFAULT_TLDS, skipDuplicates: true })
}

export async function listTlds() {
  await ensureDefaultTlds()
  return prisma.domainTld.findMany({ where: { active: true }, orderBy: { displayOrder: "asc" } })
}

export async function lookupDomain(input: string, force = false) {
  const normalized = normalizeDomain(input)
  await ensureDefaultTlds()
  const tld = await prisma.domainTld.findUnique({ where: { tld: normalized.tld } })
  if (!tld?.active || !tld.supported) {
    return { ...normalized, status: "UNSUPPORTED" as const, checkedAt: new Date(), cached: false, priceIrt: null }
  }

  const now = new Date()
  if (!force) {
    const cached = await prisma.domainLookupCache.findUnique({ where: { asciiDomain: normalized.asciiDomain } })
    if (cached && cached.expiresAt > now) {
      return { ...normalized, status: cached.status, checkedAt: cached.checkedAt, cached: true, priceIrt: tld.basePriceIrt }
    }
  }

  const settings = await getAllSettings()
  const ttlSec = Math.max(30, toNumber(settings[SETTING_KEYS.domainLookupTtlSec], 300))
  const result = await lookupWithProvider(normalized.asciiDomain)
  const row = await prisma.domainLookupCache.upsert({
    where: { asciiDomain: normalized.asciiDomain },
    create: {
      asciiDomain: normalized.asciiDomain,
      unicodeDomain: normalized.unicodeDomain,
      status: result.status,
      provider: result.provider,
      providerCode: result.providerCode,
      expiresAt: new Date(now.getTime() + ttlSec * 1000),
      meta: (result.meta ?? {}) as Prisma.InputJsonValue,
    },
    update: {
      unicodeDomain: normalized.unicodeDomain,
      status: result.status,
      provider: result.provider,
      providerCode: result.providerCode,
      checkedAt: now,
      expiresAt: new Date(now.getTime() + ttlSec * 1000),
      meta: (result.meta ?? {}) as Prisma.InputJsonValue,
    },
  })
  return { ...normalized, status: row.status, checkedAt: row.checkedAt, cached: false, priceIrt: tld.basePriceIrt }
}

function quoteSecret(settings: Record<string, string>) {
  const value = settings[SETTING_KEYS.domainQuoteSecret] || process.env.DOMAIN_QUOTE_SECRET || process.env.AUTH_SECRET
  if (!value) throw new ValidationError("کلید امنیتی صدور پیش‌فاکتور دامنه تنظیم نشده است.")
  return value
}

function signQuote(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("hex")
}

export async function createDomainQuote(userId: string, input: string) {
  const lookup = await lookupDomain(input, true)
  if (lookup.status !== "AVAILABLE" || lookup.priceIrt === null) {
    throw new ConflictError("این دامنه در حال حاضر قابل ثبت نیست.")
  }
  const settings = await getAllSettings()
  const expiresAt = new Date(Date.now() + 5 * 60_000)
  const nonce = randomBytes(12).toString("hex")
  const snapshot = { basePriceIrt: lookup.priceIrt.toString(), currency: "IRT", operation: "REGISTRATION" }
  const payload = [userId, lookup.asciiDomain, lookup.priceIrt.toString(), expiresAt.toISOString(), nonce].join("|")
  const signatureHash = signQuote(payload, quoteSecret(settings))
  return prisma.domainQuote.create({
    data: {
      userId,
      asciiDomain: lookup.asciiDomain,
      unicodeDomain: lookup.unicodeDomain,
      tld: lookup.tld,
      amountIrt: lookup.priceIrt,
      priceSnapshot: { ...snapshot, nonce, payload },
      availability: lookup.status,
      signatureHash,
      expiresAt,
    },
  })
}

export async function verifyQuote(userId: string, quoteId: string) {
  const quote = await prisma.domainQuote.findUnique({ where: { id: quoteId } })
  if (!quote || quote.userId !== userId) throw new NotFoundError("پیش‌فاکتور یافت نشد.")
  if (quote.consumedAt || quote.expiresAt <= new Date()) throw new ConflictError("اعتبار پیش‌فاکتور به پایان رسیده است.")
  const snapshot = quote.priceSnapshot as { payload?: string }
  if (!snapshot.payload) throw new ConflictError("امضای پیش‌فاکتور معتبر نیست.")
  const expected = signQuote(snapshot.payload, quoteSecret(await getAllSettings()))
  const actualBuffer = Buffer.from(quote.signatureHash)
  const expectedBuffer = Buffer.from(expected)
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new ConflictError("امضای پیش‌فاکتور معتبر نیست.")
  }
  return quote
}

export async function purchaseDomain(userId: string, quoteId: string, idempotencyKey: string) {
  const existing = await prisma.domainOrder.findUnique({ where: { idempotencyKey } })
  if (existing) {
    if (existing.userId !== userId) throw new ConflictError("کلید تکرار نامعتبر است.")
    return existing
  }
  const quote = await verifyQuote(userId, quoteId)
  const fresh = await lookupDomain(quote.asciiDomain, true)
  if (fresh.status !== "AVAILABLE") throw new ConflictError("وضعیت دامنه تغییر کرده است؛ دوباره جستجو کنید.")

  const settings = await getAllSettings()
  const holdMinutes = Math.max(15, toNumber(settings[SETTING_KEYS.domainHoldMinutes], 30))
  const firstReminder = Math.min(holdMinutes - 5, Math.max(5, toNumber(settings[SETTING_KEYS.domainFirstReminderMinutes], 10)))
  const finalReminder = Math.min(holdMinutes - 1, Math.max(firstReminder + 1, toNumber(settings[SETTING_KEYS.domainFinalReminderMinutes], 25)))
  const now = new Date()
  const orderId = randomBytes(12).toString("hex")
  const publicId = `DM-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`

  return prisma.$transaction(async (tx) => {
    const order = await tx.domainOrder.create({
      data: {
        id: orderId,
        publicId,
        userId,
        asciiDomain: quote.asciiDomain,
        unicodeDomain: quote.unicodeDomain,
        tld: quote.tld,
        amountIrt: quote.amountIrt,
        quoteId: quote.id,
        walletRef: `domain:${orderId}`,
        idempotencyKey,
        provider: settings[SETTING_KEYS.domainProvider] || "cloudflare-rdap",
        priceSnapshot: quote.priceSnapshot as Prisma.InputJsonValue,
        holdExpiresAt: new Date(now.getTime() + holdMinutes * 60_000),
        firstReminderAt: new Date(now.getTime() + firstReminder * 60_000),
        finalReminderAt: new Date(now.getTime() + finalReminder * 60_000),
      },
    })
    const reservation = await tx.domainReservation.create({
      data: { userId, quoteId: quote.id, asciiDomain: quote.asciiDomain, expiresAt: order.holdExpiresAt },
    })
    await freeze(userId, quote.amountIrt, tx, { type: "DOMAIN_ORDER_HOLD", id: order.id })
    await tx.domainQuote.update({ where: { id: quote.id }, data: { consumedAt: now } })
    await tx.domainOrder.update({ where: { id: order.id }, data: { reservationId: reservation.id } })
    await tx.domainOrderEvent.create({
      data: {
        orderId: order.id,
        operation: order.operation,
        type: "PURCHASE_CREATED",
        toStatus: order.status,
        actorType: "USER",
        actorId: userId,
        message: "سفارش ثبت دامنه ایجاد و مبلغ در کیف پول مسدود شد.",
        idempotencyKey: `${idempotencyKey}:created`,
      },
    })
    const admins = await tx.user.findMany({ where: { role: "ADMIN" }, select: { id: true } })
    if (admins.length) await tx.notification.createMany({ data: admins.map((admin) => ({ userId: admin.id, type: "GENERAL" as const, title: "سفارش جدید دامنه", body: `دامنه ${order.asciiDomain} منتظر بررسی و ثبت است.`, href: "/admin/domains" })) })
    return { ...order, reservationId: reservation.id }
  })
}

export async function processDomainOrder(orderId: string) {
  const order = await prisma.domainOrder.findUnique({ where: { id: orderId } })
  if (!order || !["PENDING_PURCHASE", "PROCESSING"].includes(order.status)) return order
  if (order.holdExpiresAt <= new Date()) return expireDomainOrder(order.id, "HOLD_EXPIRED")

  const claimed = await prisma.domainOrder.updateMany({
    where: { id: order.id, version: order.version, status: { in: ["PENDING_PURCHASE", "PROCESSING"] } },
    data: { status: "PROCESSING", version: { increment: 1 }, processingLeaseUntil: new Date(Date.now() + 60_000) },
  })
  if (!claimed.count) return prisma.domainOrder.findUnique({ where: { id: order.id } })

  const result = await registerWithProvider(order.asciiDomain)
  if (!result.ok) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.domainOrder.update({
        where: { id: order.id },
        data: { status: "FAILED", failedAt: new Date(), failureReason: result.errorCode ?? "PROVIDER_ERROR" },
      })
      await unfreeze(order.userId, order.amountIrt, tx, { type: "DOMAIN_ORDER_RELEASE", id: order.id })
      await tx.domainOrderEvent.create({
        data: {
          orderId: order.id,
          operation: order.operation,
          type: "PROVIDER_FAILED_REFUNDED",
          fromStatus: "PROCESSING",
          toStatus: "FAILED",
          actorType: "SYSTEM",
          reasonCode: result.errorCode ?? "PROVIDER_ERROR",
          message: "ثبت دامنه انجام نشد و مبلغ به کیف پول بازگشت.",
          idempotencyKey: `${order.id}:provider-failed`,
        },
      })
      return updated
    })
  }
  return prisma.$transaction(async (tx) => {
    const completedAt = new Date()
    const updated = await tx.domainOrder.update({
      where: { id: order.id },
      data: { status: "COMPLETED", completedAt, providerSnapshot: { providerReference: result.providerReference } },
    })
    await captureFrozenPurchase(order.userId, order.amountIrt, tx, { type: "DOMAIN_ORDER_CAPTURE", id: order.id })
    await tx.domainReservation.updateMany({ where: { quoteId: order.quoteId }, data: { status: "CONSUMED", consumedAt: completedAt } })
    await tx.ownedDomain.create({
      data: {
        userId: order.userId,
        orderId: order.id,
        asciiDomain: order.asciiDomain,
        unicodeDomain: order.unicodeDomain,
        provider: order.provider,
        expiresAt: result.expiresAt,
        registrarSnapshot: { providerReference: result.providerReference },
      },
    })
    return updated
  })
}

export async function expireDomainOrder(orderId: string, reason = "HOLD_EXPIRED") {
  const order = await prisma.domainOrder.findUnique({ where: { id: orderId } })
  if (!order || ["COMPLETED", "EXPIRED", "CANCELLED"].includes(order.status)) return order
  return prisma.$transaction(async (tx) => {
    const updated = await tx.domainOrder.update({
      where: { id: order.id },
      data: { status: "EXPIRED", expiredAt: new Date(), expiryReason: reason },
    })
    await tx.domainReservation.updateMany({ where: { quoteId: order.quoteId }, data: { status: "EXPIRED" } })
    await unfreeze(order.userId, order.amountIrt, tx, { type: "DOMAIN_ORDER_RELEASE", id: order.id })
    await tx.domainOrderEvent.create({
      data: {
        orderId: order.id,
        operation: order.operation,
        type: "ORDER_EXPIRED_REFUNDED",
        fromStatus: order.status,
        toStatus: "EXPIRED",
        actorType: "SYSTEM",
        reasonCode: reason,
        message: "سفارش به‌دلیل عدم اقدام مدیر در مهلت تعیین‌شده منقضی شد و مبلغ آزاد شد.",
        idempotencyKey: `${order.id}:expired`,
      },
    })
    await tx.notification.create({ data: { userId: order.userId, type: "GENERAL", title: "مهلت سفارش دامنه پایان یافت", body: `مبلغ سفارش ${order.asciiDomain} در کیف پول شما آزاد شد.`, href: "/domains" } })
    const admins = await tx.user.findMany({ where: { role: "ADMIN" }, select: { id: true } })
    if (admins.length) await tx.notification.createMany({ data: admins.map((admin) => ({ userId: admin.id, type: "GENERAL" as const, title: "سفارش دامنه خودکار منقضی شد", body: `${order.asciiDomain} بدون اقدام مدیر منقضی و مبلغ آن آزاد شد.`, href: "/admin/domains" })) })
    return updated
  })
}

export async function completeDomainOrder(orderId: string, adminId: string, providerReference?: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.domainOrder.findUnique({ where: { id: orderId } })
    if (!order) throw new NotFoundError("سفارش دامنه یافت نشد.")
    if (!['PENDING_PURCHASE', 'PROCESSING'].includes(order.status)) throw new ConflictError("این سفارش قابل تکمیل نیست.")
    const completedAt = new Date()
    const updated = await tx.domainOrder.update({
      where: { id: order.id },
      data: { status: "COMPLETED", completedAt, providerSnapshot: { providerReference: providerReference ?? null } },
    })
    await captureFrozenPurchase(order.userId, order.amountIrt, tx, { type: "DOMAIN_ORDER_CAPTURE", id: order.id })
    await tx.domainReservation.updateMany({ where: { quoteId: order.quoteId }, data: { status: "CONSUMED", consumedAt: completedAt } })
    await tx.ownedDomain.upsert({
      where: { orderId: order.id },
      create: { userId: order.userId, orderId: order.id, asciiDomain: order.asciiDomain, unicodeDomain: order.unicodeDomain, provider: order.provider, registrarSnapshot: { providerReference: providerReference ?? null } },
      update: { status: "ACTIVE", registrarSnapshot: { providerReference: providerReference ?? null } },
    })
    await tx.domainOrderEvent.create({ data: { orderId: order.id, operation: order.operation, type: "REGISTRATION_COMPLETED", fromStatus: order.status, toStatus: "COMPLETED", actorType: "ADMIN", actorId: adminId, message: "دامنه با موفقیت ثبت شد.", idempotencyKey: `${order.id}:completed` } })
    await tx.notification.create({ data: { userId: order.userId, type: "GENERAL", title: "دامنه شما ثبت شد", body: `${order.asciiDomain} با موفقیت ثبت و به دارایی‌های شما اضافه شد.`, href: "/domains" } })
    return updated
  })
}

export async function failDomainOrder(orderId: string, adminId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.domainOrder.findUnique({ where: { id: orderId } })
    if (!order) throw new NotFoundError("سفارش دامنه یافت نشد.")
    if (!['PENDING_PURCHASE', 'PROCESSING'].includes(order.status)) throw new ConflictError("این سفارش قابل رد نیست.")
    const updated = await tx.domainOrder.update({ where: { id: order.id }, data: { status: "FAILED", failedAt: new Date(), failureReason: reason } })
    await unfreeze(order.userId, order.amountIrt, tx, { type: "DOMAIN_ORDER_RELEASE", id: order.id })
    await tx.domainReservation.updateMany({ where: { quoteId: order.quoteId }, data: { status: "RELEASED" } })
    await tx.domainOrderEvent.create({ data: { orderId: order.id, operation: order.operation, type: "REGISTRATION_FAILED", fromStatus: order.status, toStatus: "FAILED", actorType: "ADMIN", actorId: adminId, reasonCode: reason, message: "ثبت دامنه انجام نشد و مبلغ آزاد شد.", idempotencyKey: `${order.id}:failed` } })
    await tx.notification.create({ data: { userId: order.userId, type: "GENERAL", title: "ثبت دامنه انجام نشد", body: `مبلغ سفارش ${order.asciiDomain} در کیف پول شما آزاد شد.`, href: "/domains" } })
    return updated
  })
}

export async function extendDomainOrderHold(orderId: string, adminId: string, minutes: number) {
  if (minutes < 15 || minutes > 4320) throw new ValidationError("مدت تمدید نگهداری معتبر نیست.")
  return prisma.$transaction(async (tx) => {
    const order = await tx.domainOrder.findUnique({ where: { id: orderId } })
    if (!order) throw new NotFoundError("سفارش دامنه یافت نشد.")
    if (!['PENDING_PURCHASE', 'PROCESSING'].includes(order.status) || order.holdExpiresAt <= new Date()) throw new ConflictError("مهلت این سفارش قابل تمدید نیست.")
    const holdExpiresAt = new Date(order.holdExpiresAt.getTime() + minutes * 60_000)
    const updated = await tx.domainOrder.update({ where: { id: order.id }, data: { holdExpiresAt, finalReminderAt: new Date(holdExpiresAt.getTime() - 5 * 60_000), finalReminderSentAt: null, extensionCount: { increment: 1 } } })
    await tx.domainReservation.updateMany({ where: { quoteId: order.quoteId }, data: { expiresAt: holdExpiresAt } })
    await tx.domainOrderEvent.create({ data: { orderId: order.id, operation: order.operation, type: "HOLD_EXTENDED", fromStatus: order.status, toStatus: order.status, actorType: "ADMIN", actorId: adminId, message: `مهلت بررسی سفارش ${minutes} دقیقه تمدید شد.`, meta: { minutes }, idempotencyKey: `${order.id}:extend:${order.extensionCount + 1}` } })
    return updated
  })
}

export async function processDueDomainOrders() {
  const now = new Date()
  const [expired, firstReminders, finalReminders] = await Promise.all([
    prisma.domainOrder.findMany({ where: { status: { in: ["PENDING_PURCHASE", "PROCESSING"] }, holdExpiresAt: { lte: now } }, select: { id: true }, take: 50 }),
    prisma.domainOrder.findMany({ where: { status: { in: ["PENDING_PURCHASE", "PROCESSING"] }, firstReminderAt: { lte: now }, firstReminderSentAt: null }, take: 50 }),
    prisma.domainOrder.findMany({ where: { status: { in: ["PENDING_PURCHASE", "PROCESSING"] }, finalReminderAt: { lte: now }, finalReminderSentAt: null }, take: 50 }),
  ])

  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } })
  let reminders = 0
  for (const order of firstReminders) {
    if (admins.length) await prisma.notification.createMany({ data: admins.map((admin) => ({ userId: admin.id, type: "GENERAL" as const, title: "سفارش دامنه هنوز بررسی نشده است", body: `${order.asciiDomain} در انتظار اقدام مدیر است.`, href: "/admin/domains" })) })
    await prisma.domainOrder.updateMany({ where: { id: order.id, firstReminderSentAt: null }, data: { firstReminderSentAt: now } })
    reminders += 1
  }
  for (const order of finalReminders) {
    if (admins.length) await prisma.notification.createMany({ data: admins.map((admin) => ({ userId: admin.id, type: "GENERAL" as const, title: "مهلت بررسی سفارش رو به پایان است", body: `مهلت ${order.asciiDomain} به‌زودی تمام و وجه آزاد می‌شود.`, href: "/admin/domains" })) })
    await prisma.domainOrder.updateMany({ where: { id: order.id, finalReminderSentAt: null }, data: { finalReminderSentAt: now } })
    reminders += 1
  }
  for (const item of expired) await expireDomainOrder(item.id)
  return { processed: 0, expired: expired.length, reminders }
}

export function listUserDomainOrders(userId: string) {
  return prisma.domainOrder.findMany({ where: { userId }, include: { events: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" }, take: 30 })
}

export function listUserOwnedDomains(userId: string) {
  return prisma.ownedDomain.findMany({ where: { userId }, orderBy: { createdAt: "desc" } })
}
