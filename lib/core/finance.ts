import { prisma } from "@/lib/db"
import { secureSlug } from "@/lib/id"
import { ConflictError, NotFoundError, ValidationError } from "./errors"
import { deposit, freeze, getBalances, mutateWallet, unfreeze, ensureWallet } from "./wallet"
import { serializableTx } from "./ledger"
import { audit } from "./audit"
import { notifyDepositApproved, notifyWithdrawApproved } from "@/lib/telegram/notify"
import { createNotification } from "./notifications"
import { formatToman } from "@/lib/format"

// --- Deposits ----------------------------------------------------------------

export interface CreateDepositInput {
  userId: string
  amount: bigint
  cardLast4?: string
  reference?: string
  note?: string
}

/** User submits a card-to-card deposit request awaiting admin approval. */
export async function createDepositRequest(input: CreateDepositInput) {
  if (input.amount < 10000n) throw new ValidationError("حداقل مبلغ واریز ۱۰٬۰۰۰ تومان است")
  const req = await prisma.depositRequest.create({
    data: {
      publicId: secureSlug("dep"),
      userId: input.userId,
      amount: input.amount,
      cardLast4: input.cardLast4,
      reference: input.reference,
      note: input.note,
    },
  })
  await audit({ actorId: input.userId, action: "deposit.request", entity: "deposit", entityId: req.id, meta: { amount: input.amount.toString() } })
  return req
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

export async function listDeposits(status?: "PENDING" | "APPROVED" | "REJECTED") {
  return prisma.depositRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { displayName: true, alias: true } } },
  })
}

export async function listWithdrawals(status?: "PENDING" | "APPROVED" | "REJECTED" | "PAID") {
  return prisma.withdrawalRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { displayName: true, alias: true } } },
  })
}
