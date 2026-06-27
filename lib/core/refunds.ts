import { prisma } from "@/lib/db"
import { secureSlug } from "@/lib/id"
import { ConflictError, NotFoundError, ValidationError } from "./errors"
import { freeze, getBalances, mutateWallet, unfreeze } from "./wallet"
import { serializableTx } from "./ledger"
import { audit } from "./audit"
import { createNotification } from "./notifications"
import { formatToman } from "@/lib/format"

const MIN_REFUND = 10000n

function onlyDigits(value: string): string {
  return (value || "").replace(/\D/g, "")
}

export interface CreateRefundInput {
  userId: string
  amount: bigint
  fullName: string
  nationalId: string
  nationalCardUrl: string
  cardNumber: string
  iban?: string
  reason?: string
}

/**
 * User requests a refund of wallet balance back to their bank card. To prevent
 * money laundering / fraud the destination card MUST match a card the user
 * actually deposited from (an approved deposit with the same last 4 digits),
 * and identity proof (national id + uploaded national card image) is required.
 * Funds are frozen immediately so they can't be spent while the request is open.
 */
export async function createRefundRequest(input: CreateRefundInput) {
  const fullName = input.fullName.trim()
  const nationalId = onlyDigits(input.nationalId)
  const cardNumber = onlyDigits(input.cardNumber)

  if (fullName.length < 3) throw new ValidationError("نام و نام خانوادگی را کامل وارد کنید")
  if (nationalId.length !== 10) throw new ValidationError("کد ملی باید دقیقاً ۱۰ رقم باشد")
  if (cardNumber.length !== 16) throw new ValidationError("شماره کارت بانکی باید ۱۶ رقم باشد")
  if (!input.nationalCardUrl) throw new ValidationError("بارگذاری تصویر کارت ملی الزامی است")
  if (input.amount < MIN_REFUND) throw new ValidationError("حداقل مبلغ بازگشت وجه ۱۰٬۰۰۰ تومان است")

  const cardLast4 = cardNumber.slice(-4)

  // Identity guard: the destination card must match a card the user actually
  // deposited from — refunds only ever go back to the depositing card.
  const matched = await prisma.depositRequest.findFirst({
    where: { userId: input.userId, status: "APPROVED", cardLast4 },
    orderBy: { createdAt: "desc" },
  })
  if (!matched) {
    throw new ValidationError(
      "این کارت با هیچ واریز تأییدشده‌ای مطابقت ندارد. بازگشت وجه فقط به همان کارتی که با آن واریز کرده‌اید انجام می‌شود.",
    )
  }

  return prisma.$transaction(async (tx) => {
    const balances = await getBalances(input.userId, tx)
    if (balances.availableBalance < input.amount) {
      throw new ValidationError("موجودی قابل بازگشت کافی نیست")
    }
    await freeze(input.userId, input.amount, tx, { type: "refund", id: "pending" })
    const req = await tx.refundRequest.create({
      data: {
        publicId: secureSlug("rf"),
        userId: input.userId,
        amount: input.amount,
        fullName,
        nationalId,
        nationalCardUrl: input.nationalCardUrl,
        cardNumber,
        cardLast4,
        iban: input.iban ? onlyDigits(input.iban) : null,
        reason: input.reason?.trim() || null,
        matchedDepositId: matched.id,
      },
    })
    await audit(
      { actorId: input.userId, action: "refund.request", entity: "refund", entityId: req.id, meta: { amount: input.amount.toString() } },
      tx,
    )
    return req
  })
}

export async function listRefunds(userId: string) {
  return prisma.refundRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
}

// --- Admin actions -----------------------------------------------------------

export async function listRefundsAdmin(status?: "PENDING" | "APPROVED" | "REJECTED" | "PAID") {
  return prisma.refundRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { displayName: true, alias: true } } },
  })
}

/** Admin approves & pays out a refund: capture the held funds out of the wallet. */
export async function approveRefund(refundId: string, adminId: string) {
  const updated = await prisma.$transaction(async (tx) => {
    const req = await tx.refundRequest.findUnique({ where: { id: refundId } })
    if (!req) throw new NotFoundError("درخواست بازگشت وجه یافت نشد")
    if (req.status !== "PENDING") throw new ConflictError("این درخواست قبلاً بررسی شده است")

    await mutateWallet(
      {
        userId: req.userId,
        type: "REFUND",
        deltaTotal: -req.amount,
        deltaFrozen: -req.amount,
        amount: req.amount,
        refType: "refund",
        refId: req.id,
      },
      tx,
    )
    const updated = await tx.refundRequest.update({
      where: { id: req.id, status: "PENDING" },
      data: { status: "PAID", reviewedById: adminId, reviewedAt: new Date() },
    })
    await audit(
      { actorId: adminId, action: "refund.approve", entity: "refund", entityId: req.id, meta: { amount: req.amount.toString() } },
      tx,
    )
    return updated
  })
  await createNotification({
    userId: updated.userId,
    type: "GENERAL",
    title: "بازگشت وجه انجام شد",
    body: `مبلغ ${formatToman(updated.amount)} تومان به کارت شما بازگردانده شد.`,
    href: "/refunds",
  }).catch(() => {})
  return updated
}

/** Admin rejects a refund: release the frozen hold back to available balance. */
export async function rejectRefund(refundId: string, adminId: string, reason?: string) {
  const updated = await prisma.$transaction(async (tx) => {
    const req = await tx.refundRequest.findUnique({ where: { id: refundId } })
    if (!req) throw new NotFoundError("درخواست بازگشت وجه یافت نشد")
    if (req.status !== "PENDING") throw new ConflictError("این درخواست قبلاً بررسی شده است")
    await unfreeze(req.userId, req.amount, tx, { type: "refund", id: req.id })
    const updated = await tx.refundRequest.update({
      where: { id: req.id, status: "PENDING" },
      data: { status: "REJECTED", reviewedById: adminId, reviewedAt: new Date(), rejectReason: reason },
    })
    await audit(
      { actorId: adminId, action: "refund.reject", entity: "refund", entityId: req.id, meta: { reason } },
      tx,
    )
    return updated
  })
  await createNotification({
    userId: updated.userId,
    type: "GENERAL",
    title: "درخواست بازگشت وجه رد شد",
    body: updated.rejectReason ? `دلیل: ${updated.rejectReason}` : "درخواست بازگشت وجه شما رد شد.",
    href: "/refunds",
  }).catch(() => {})
  return updated
}
