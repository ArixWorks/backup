import type { DepositMethod, DepositStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { secureSlug } from "@/lib/id"
import { ConflictError, NotFoundError, ValidationError } from "./errors"
import { deposit, freeze, getBalances, mutateWallet, unfreeze, ensureWallet } from "./wallet"
import { serializableTx } from "./ledger"
import { audit } from "./audit"
import { getRate, RATE_SCALE } from "./currencies"
import { getPaymentConfig } from "./settings"
import {
  notifyDepositApproved,
  notifyWithdrawApproved,
  notifyDepositPending,
  notifyDepositRejected,
} from "@/lib/telegram/notify"
import { createNotification } from "./notifications"
import { sendDepositApprovedEmail, sendDepositRejectedEmail } from "@/lib/email"
import { formatToman } from "@/lib/format"

/** How long a top-up request stays "live" with a payable amount/countdown. */
export const DEPOSIT_TTL_MS = 15 * 60 * 1000

/** Star price in USD cents (1 Star ≈ $0.02). Used to size Stars invoices. */
const STAR_USD_CENTS = 2

// --- Deposits ----------------------------------------------------------------

export interface CreateDepositInput {
  userId: string
  amount: bigint // wallet credit in IRT base minor units (Toman)
  method?: DepositMethod // CARD (default) | TON | USDT | STARS
  cardLast4?: string
  reference?: string
  note?: string
  receiptUrl?: string
}

/**
 * Convert an IRT amount into another currency's minor units, then nudge the
 * trailing two digits to a unique value so each pending crypto deposit has a
 * distinct amount the admin can match against on-chain.
 */
async function convertWithUniqueTail(amountIrt: bigint, to: string): Promise<{ payAmount: bigint; rate: bigint }> {
  const rate = await getRate("IRT", to)
  if (!rate || rate <= 0n) throw new ValidationError("نرخ تبدیل ارز در دسترس نیست")
  const converted = (amountIrt * rate) / RATE_SCALE
  if (converted <= 0n) throw new ValidationError("مبلغ واریز برای این روش بسیار کم است")
  // Replace the last two minor digits (cents) with a unique 1..99 tail.
  const uniqueCents = BigInt(1 + Math.floor(Math.random() * 98))
  const payAmount = (converted / 100n) * 100n + uniqueCents
  return { payAmount, rate }
}

export interface DepositInstructions {
  id: string
  publicId: string
  method: DepositMethod
  amount: bigint
  payCurrency: string
  payAmount: bigint
  payAddress: string | null
  payNetwork: string | null
  payTag: string | null
  expiresAt: Date | null
  status: string
}

/**
 * Create a top-up request for any method. Wallet credit (`amount`) is always in
 * IRT; the user pays in `payCurrency`. Crypto methods get a unique amount + a
 * 15-minute countdown; cards get a unique transfer-note code. STARS requests
 * carry a star count and are credited by the Telegram webhook.
 */
export async function createDepositRequest(input: CreateDepositInput): Promise<DepositInstructions> {
  const method: DepositMethod = input.method ?? "CARD"
  const cfg = await getPaymentConfig()
  const minIrt = BigInt(cfg.minToman)
  if (input.amount < minIrt) {
    throw new ValidationError(`حداقل مبلغ واریز ${formatToman(minIrt)} تومان است`)
  }
  const slot = cfg.methods.find((m) => m.method === method)
  if (!slot || !slot.enabled) throw new ValidationError("این روش پرداخت در دسترس نیست")

  let payCurrency = "IRT"
  let payAmount = input.amount
  let payAddress: string | null = slot.address
  let payNetwork: string | null = slot.network ?? null
  let payTag: string | null = null
  let rateUsed: bigint | null = null
  let expiresAt: Date | null = new Date(Date.now() + DEPOSIT_TTL_MS)

  if (method === "USDT" || method === "TON") {
    payCurrency = method === "USDT" ? "USDT" : "TON"
    const { payAmount: pa, rate } = await convertWithUniqueTail(input.amount, payCurrency)
    payAmount = pa
    rateUsed = rate
  } else if (method === "STARS") {
    payCurrency = "XTR"
    const usdRate = await getRate("IRT", "USD")
    if (!usdRate || usdRate <= 0n) throw new ValidationError("نرخ تبدیل ارز در دسترس نیست")
    const usdCents = (input.amount * usdRate) / RATE_SCALE
    const stars = usdCents / BigInt(STAR_USD_CENTS)
    payAmount = stars > 0n ? stars : 1n
    rateUsed = usdRate
    payAddress = null
    payNetwork = null
    expiresAt = null // Stars invoices manage their own lifetime
  } else {
    // CARD: pay the exact IRT amount to the destination card. Iranian bank
    // transfers have no user-enterable reference/tracking code, so we don't
    // generate one — the admin matches the deposit by amount + receipt.
    payAddress = slot.address
  }

  const req = await prisma.depositRequest.create({
    data: {
      publicId: secureSlug("dep"),
      userId: input.userId,
      amount: input.amount,
      method,
      // Card / crypto requests start as a private draft and are only submitted
      // for admin review once the user confirms the transfer ("I've paid").
      // Stars are settled by the Telegram webhook so they stay PENDING.
      status: method === "STARS" ? "PENDING" : "AWAITING_PAYMENT",
      payCurrency,
      payAmount,
      payAddress,
      payNetwork,
      payTag,
      rateUsed,
      expiresAt,
      cardLast4: input.cardLast4,
      reference: input.reference,
      note: input.note,
      receiptUrl: input.receiptUrl,
    },
  })
  await audit({
    actorId: input.userId,
    action: "deposit.request",
    entity: "deposit",
    entityId: req.id,
    meta: { amount: input.amount.toString(), method, payAmount: payAmount.toString(), payCurrency },
  })
  return {
    id: req.id,
    publicId: req.publicId,
    method: req.method,
    amount: req.amount,
    payCurrency: req.payCurrency,
    payAmount: req.payAmount,
    payAddress: req.payAddress,
    payNetwork: req.payNetwork,
    payTag: req.payTag,
    expiresAt: req.expiresAt,
    status: req.status,
  }
}

/**
 * User attaches a receipt screenshot and/or marks the transfer as sent. This is
 * the moment the request is actually submitted to the admin: a draft
 * (`AWAITING_PAYMENT`) is promoted to `PENDING`. Only then does it appear in the
 * admin review queue and a "request received" record/notification is created.
 * `confirmPaid` distinguishes a receipt-only upload from the final confirm tap.
 */
export async function claimDepositPaid(
  depositId: string,
  userId: string,
  receiptUrl?: string,
  confirmPaid = true,
) {
  const req = await prisma.depositRequest.findUnique({ where: { id: depositId } })
  if (!req || req.userId !== userId) throw new NotFoundError("درخواست واریز یافت نشد")
  if (req.status !== "AWAITING_PAYMENT" && req.status !== "PENDING") {
    throw new ConflictError("این درخواست قابل ویرایش نیست")
  }
  // A receipt upload before the final confirm keeps the request as a draft.
  const submitting = confirmPaid && req.status === "AWAITING_PAYMENT"
  const updated = await prisma.depositRequest.update({
    where: { id: req.id },
    data: {
      status: submitting ? "PENDING" : req.status,
      paidClaimedAt: confirmPaid ? new Date() : req.paidClaimedAt,
      receiptUrl: receiptUrl ?? req.receiptUrl,
    },
  })
  await audit({
    actorId: userId,
    action: submitting ? "deposit.submit" : "deposit.claimPaid",
    entity: "deposit",
    entityId: req.id,
  })
  // On the transition draft -> submitted, record the request everywhere the
  // user might look so they have proof it was registered.
  if (submitting) {
    await createNotification({
      userId: updated.userId,
      type: "DEPOSIT_PENDING",
      title: "درخواست افزایش موجودی ثبت شد",
      body: `درخواست افزایش موجودی به مبلغ ${formatToman(updated.amount)} تومان ثبت شد و در انتظار تأیید ادمین است.`,
      href: "/wallet",
    }).catch(() => {})
    await notifyDepositPending(updated.userId, updated.amount).catch(() => {})
  }
  return updated
}

/**
 * Credit a Telegram Stars deposit when `successful_payment` arrives. Idempotent
 * on the Telegram charge id so repeated webhooks never double-credit.
 */
export async function approveStarsDeposit(payload: string, chargeId: string) {
  const { updated, credited } = await serializableTx(async (tx) => {
    const req = await tx.depositRequest.findFirst({ where: { starsPayload: payload, method: "STARS" } })
    if (!req) throw new NotFoundError("درخواست واریز یافت نشد")
    if (req.starsChargeId || req.status === "APPROVED") return { updated: req, credited: false }

    await ensureWallet(req.userId, tx)
    await deposit(req.userId, req.amount, tx, { type: "deposit", id: req.id })
    const updated = await tx.depositRequest.update({
      where: { id: req.id },
      data: { status: "APPROVED", starsChargeId: chargeId, reviewedAt: new Date() },
    })
    await audit({ actorId: req.userId, action: "deposit.stars.approve", entity: "deposit", entityId: req.id, meta: { chargeId } }, tx)
    return { updated, credited: true }
  })
  if (credited) {
    await notifyDepositApproved(updated.userId, updated.amount).catch(() => {})
    await createNotification({
      userId: updated.userId,
      type: "DEPOSIT_APPROVED",
      title: "واریز تأیید شد",
      body: `مبلغ ${formatToman(updated.amount)} تومان به کیف پول شما اضافه شد.`,
      href: "/wallet",
    }).catch(() => {})
  }
  return updated
}

/** Admin approves a deposit: credit wallet atomically and mark approved. */
export async function approveDeposit(depositId: string, adminId: string) {
  const updated = await serializableTx(async (tx) => {
    const req = await tx.depositRequest.findUnique({ where: { id: depositId } })
    if (!req) throw new NotFoundError("درخواست واریز یافت نشد")
    if (req.status !== "PENDING") throw new ConflictError("این درخواست قبلاً بررسی شده است")

    await ensureWallet(req.userId, tx)
    await deposit(req.userId, req.amount, tx, { type: "deposit", id: req.id })

    const updated = await tx.depositRequest.update({
      where: { id: req.id, status: "PENDING" },
      data: { status: "APPROVED", reviewedById: adminId, reviewedAt: new Date() },
    })
    await audit({ actorId: adminId, action: "deposit.approve", entity: "deposit", entityId: req.id, meta: { amount: req.amount.toString() } }, tx)
    return updated
  })
  await notifyDepositApproved(updated.userId, updated.amount)
  await createNotification({
    userId: updated.userId,
    type: "DEPOSIT_APPROVED",
    title: "واریز تأیید شد",
    body: `مبلغ ${formatToman(updated.amount)} تومان به کیف پول شما اضافه شد.`,
    href: "/wallet",
  }).catch(() => {})
  await sendDepositApprovedEmail({
    userId: updated.userId,
    depositId: updated.id,
    amount: formatToman(updated.amount),
    currency: "IRT",
  })
  return updated
}

export async function rejectDeposit(depositId: string, adminId: string, reason?: string) {
  const req = await prisma.depositRequest.findUnique({ where: { id: depositId } })
  if (!req) throw new NotFoundError("درخواست واریز یافت نشد")
  if (req.status !== "PENDING") throw new ConflictError("این درخواست قبلاً بررسی شده است")
  const updated = await prisma.depositRequest.update({
    where: { id: req.id, status: "PENDING" },
    data: { status: "REJECTED", reviewedById: adminId, reviewedAt: new Date(), rejectReason: reason },
  })
  await audit({ actorId: adminId, action: "deposit.reject", entity: "deposit", entityId: req.id, meta: { reason } })
  await createNotification({
    userId: updated.userId,
    type: "DEPOSIT_REJECTED",
    title: "درخواست افزایش موجودی رد شد",
    body: updated.rejectReason
      ? `درخواست افزایش موجودی ${formatToman(updated.amount)} تومان رد شد. دلیل: ${updated.rejectReason}`
      : `درخواست افزایش موجودی ${formatToman(updated.amount)} تومان رد شد.`,
    href: "/wallet",
  }).catch(() => {})
  await notifyDepositRejected(updated.userId, updated.amount, updated.rejectReason ?? undefined).catch(() => {})
  await sendDepositRejectedEmail({
    userId: updated.userId,
    depositId: updated.id,
    amount: formatToman(updated.amount),
    currency: "IRT",
    reason: updated.rejectReason ?? undefined,
  })
  return updated
}

// --- Withdrawals -------------------------------------------------------------

export interface CreateWithdrawalInput {
  userId: string
  amount: bigint
  iban?: string
  cardNumber?: string
  note?: string
}

/**
 * User requests a withdrawal. Funds are frozen immediately so they cannot be
 * spent while the request is pending.
 */
export async function createWithdrawalRequest(input: CreateWithdrawalInput) {
  if (input.amount < 10000n) throw new ValidationError("حداقل مبلغ برداشت ۱۰٬۰۰۰ تومان است")
  return prisma.$transaction(async (tx) => {
    const balances = await getBalances(input.userId, tx)
    if (balances.availableBalance < input.amount) {
      throw new ValidationError("موجودی قابل برداشت کافی نیست")
    }
    await freeze(input.userId, input.amount, tx, { type: "withdrawal", id: "pending" })
    const req = await tx.withdrawalRequest.create({
      data: {
        publicId: secureSlug("wd"),
        userId: input.userId,
        amount: input.amount,
        iban: input.iban,
        cardNumber: input.cardNumber,
        note: input.note,
      },
    })
    await audit({ actorId: input.userId, action: "withdrawal.request", entity: "withdrawal", entityId: req.id, meta: { amount: input.amount.toString() } }, tx)
    return req
  })
}

/** Admin approves & pays out: deduct total and release the frozen hold. */
export async function approveWithdrawal(withdrawalId: string, adminId: string) {
  const updated = await serializableTx(async (tx) => {
    const req = await tx.withdrawalRequest.findUnique({ where: { id: withdrawalId } })
    if (!req) throw new NotFoundError("درخواست برداشت یافت نشد")
    if (req.status !== "PENDING") throw new ConflictError("این درخواست قبلاً بررسی شده است")

    // total -= amount AND frozen -= amount (capture the held funds as a payout).
    await mutateWallet(
      {
        userId: req.userId,
        type: "WITHDRAWAL",
        deltaTotal: -req.amount,
        deltaFrozen: -req.amount,
        amount: req.amount,
        refType: "withdrawal",
        refId: req.id,
      },
      tx,
    )
    const updated = await tx.withdrawalRequest.update({
      where: { id: req.id, status: "PENDING" },
      data: { status: "PAID", reviewedById: adminId, reviewedAt: new Date() },
    })
    await audit({ actorId: adminId, action: "withdrawal.approve", entity: "withdrawal", entityId: req.id, meta: { amount: req.amount.toString() } }, tx)
    return updated
  })
  await notifyWithdrawApproved(updated.userId, updated.amount)
  await createNotification({
    userId: updated.userId,
    type: "WITHDRAW_APPROVED",
    title: "برداشت پرداخت شد",
    body: `درخواست برداشت ${formatToman(updated.amount)} تومان شما پرداخت شد.`,
    href: "/wallet",
  }).catch(() => {})
  return updated
}

/** Admin rejects a withdrawal: release the frozen hold back to available. */
export async function rejectWithdrawal(withdrawalId: string, adminId: string, reason?: string) {
  return prisma.$transaction(async (tx) => {
    const req = await tx.withdrawalRequest.findUnique({ where: { id: withdrawalId } })
    if (!req) throw new NotFoundError("درخواست برداشت یافت نشد")
    if (req.status !== "PENDING") throw new ConflictError("این درخواست قبلاً بررسی شده است")
    await unfreeze(req.userId, req.amount, tx, { type: "withdrawal", id: req.id })
    const updated = await tx.withdrawalRequest.update({
      where: { id: req.id, status: "PENDING" },
      data: { status: "REJECTED", reviewedById: adminId, reviewedAt: new Date(), rejectReason: reason },
    })
    await audit({ actorId: adminId, action: "withdrawal.reject", entity: "withdrawal", entityId: req.id, meta: { reason } }, tx)
    return updated
  })
}

// --- Listings ----------------------------------------------------------------

export async function listDeposits(status?: DepositStatus) {
  return prisma.depositRequest.findMany({
    // Never surface unsubmitted drafts to admins — only requests the user has
    // actually confirmed (PENDING and beyond).
    where: status ? { status } : { status: { not: "AWAITING_PAYMENT" } },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { displayName: true, alias: true } } },
  })
}

/** Mark stale, unsubmitted card/crypto drafts EXPIRED (cron-friendly, no credit). */
export async function expireStaleDeposits() {
  const res = await prisma.depositRequest.updateMany({
    where: {
      status: { in: ["AWAITING_PAYMENT", "PENDING"] },
      paidClaimedAt: null,
      expiresAt: { lt: new Date() },
    },
    data: { status: "EXPIRED" },
  })
  return res.count
}

export async function listWithdrawals(status?: "PENDING" | "APPROVED" | "REJECTED" | "PAID") {
  return prisma.withdrawalRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { displayName: true, alias: true } } },
  })
}
