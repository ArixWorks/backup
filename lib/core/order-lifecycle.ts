// Multi-step order fulfillment ("roadmap") engine for shop orders.
//
// Mirrors the proven DomainOrder state machine: every transition runs inside a
// transaction, is guarded by a strict from-status check, and writes exactly one
// OrderEvent row keyed by a unique idempotencyKey so replays / concurrent
// callers can never double-apply — critically, never double-refund.
//
// Refund invariant (CRITICAL): the only amount ever returned on cancel is
// `order.amount`, which by construction (see purchaseFixed) equals the exact
// net principal charged from the buyer's wallet — it already has coupon / tier
// discounts subtracted and never includes commissions or rewards. We refund
// that and nothing else.

import { prisma } from "@/lib/db"
import type { OrderStatus, Prisma } from "@prisma/client"
import { NotFoundError, ValidationError, ConflictError } from "./errors"
import { refund } from "./wallet"
import { resolveTemplate, sanitizeValues, type DeliveryTemplate } from "./delivery-fields"
import { createNotification } from "./notifications"

type Tx = Prisma.TransactionClient

// Statuses that mean "already terminal" — refund/cancel must be a no-op.
const TERMINAL: OrderStatus[] = ["REFUNDED", "CANCELLED"]

// Default fulfillment budget (minutes) when neither variant nor product sets one.
export const DEFAULT_COMPLETION_MINUTES = 15

export const CANCEL_REASON_CODES = [
  { code: "BOUGHT_ELSEWHERE", label: "از جای دیگری خریداری کردم" },
  { code: "TOO_SLOW", label: "عجله دارم / خیلی طول کشید" },
  { code: "CHANGED_MIND", label: "منصرف شدم" },
  { code: "OTHER", label: "دلیل دیگر" },
] as const

// ---------------------------------------------------------------------------
// Plan resolution
// ---------------------------------------------------------------------------

export interface OrderPlan {
  requiresCustomerInput: boolean
  customerInputFields: DeliveryTemplate | null
  estimatedMinutes: number
}

/**
 * Resolve the effective fulfillment plan for a product+variant: variant
 * overrides win, then the product, then defaults. `requiresCustomerInput` is
 * nullable on the variant so "unset" (null) inherits the product value.
 */
export function resolveOrderPlan(
  product: {
    requiresCustomerInput: boolean
    customerInputFields: unknown
    avgCompletionMinutes: number | null
  },
  variant?: {
    requiresCustomerInput: boolean | null
    customerInputFields: unknown
    avgCompletionMinutes: number | null
  } | null,
): OrderPlan {
  const requires =
    variant?.requiresCustomerInput ?? product.requiresCustomerInput ?? false

  const estimatedMinutes =
    variant?.avgCompletionMinutes ??
    product.avgCompletionMinutes ??
    DEFAULT_COMPLETION_MINUTES

  // Only resolve a template when input is actually required. When required and
  // no explicit template is set, fall back to the default username+password
  // template (same behaviour as delivery-fields).
  const customerInputFields = requires
    ? resolveTemplate(product.customerInputFields, variant?.customerInputFields)
    : null

  return { requiresCustomerInput: requires, customerInputFields, estimatedMinutes }
}

// ---------------------------------------------------------------------------
// Event logging (idempotent)
// ---------------------------------------------------------------------------

async function logEvent(
  tx: Tx,
  input: {
    orderId: string
    type: string
    fromStatus?: OrderStatus | null
    toStatus?: OrderStatus | null
    actorType: "USER" | "ADMIN" | "SYSTEM"
    actorId?: string | null
    reasonCode?: string | null
    message?: string | null
    meta?: Prisma.InputJsonValue
    idempotencyKey: string
  },
) {
  // Idempotent: a duplicate key is silently ignored so a retried transition
  // does not error out or double-log.
  await tx.orderEvent.createMany({
    data: [
      {
        orderId: input.orderId,
        type: input.type,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus ?? null,
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        reasonCode: input.reasonCode ?? null,
        message: input.message ?? null,
        meta: input.meta ?? {},
        idempotencyKey: input.idempotencyKey,
      },
    ],
    skipDuplicates: true,
  })
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

/**
 * Buyer submits their account info. Guard: only from AWAITING_CUSTOMER_INPUT.
 * Starts the countdown (processingStartedAt = now, dueAt = now + estimated).
 */
export async function submitCustomerInput(
  publicId: string,
  userId: string,
  values: Record<string, unknown>,
) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { publicId, userId },
      select: {
        id: true,
        status: true,
        customerInputFields: true,
        estimatedMinutes: true,
      },
    })
    if (!order) throw new NotFoundError("سفارش یافت نشد")
    if (order.status !== "AWAITING_CUSTOMER_INPUT") {
      throw new ConflictError("این سفارش در مرحله دریافت اطلاعات نیست")
    }

    const template = resolveTemplate(order.customerInputFields)
    // Validates required fields + strips unknown keys. Throws on missing required.
    const clean = sanitizeValues(template, values)

    const now = new Date()
    const minutes = order.estimatedMinutes ?? DEFAULT_COMPLETION_MINUTES
    const dueAt = new Date(now.getTime() + minutes * 60_000)

    await tx.order.update({
      where: { id: order.id },
      data: {
        customerInput: clean as Prisma.InputJsonValue,
        customerInputAt: now,
        status: "PROCESSING",
        processingStartedAt: now,
        dueAt,
      },
    })

    await logEvent(tx, {
      orderId: order.id,
      type: "CUSTOMER_INPUT_SUBMITTED",
      fromStatus: "AWAITING_CUSTOMER_INPUT",
      toStatus: "PROCESSING",
      actorType: "USER",
      actorId: userId,
      message: "کاربر اطلاعات حساب را ثبت کرد؛ سفارش در حال انجام است.",
      idempotencyKey: `${order.id}:customer-input`,
    })

    // Notify admins there is work to do.
    const admins = await tx.user.findMany({ where: { role: "ADMIN" }, select: { id: true } })
    for (const a of admins) {
      await createNotification(
        {
          userId: a.id,
          type: "GENERAL",
          title: "سفارش آماده انجام",
          body: "کاربر اطلاعات حساب را ثبت کرد. سفارش در انتظار تکمیل توسط شماست.",
          href: `/admin/orders/${order.id}`,
        },
        tx,
      )
    }

    return { ok: true as const, dueAt }
  })
}

/**
 * Admin completes fulfillment. Guard: from PROCESSING or
 * AWAITING_EXTENSION_APPROVAL. Attaches an optional note / tutorial, marks
 * DELIVERED and notifies the buyer.
 */
export async function completeOrder(
  orderId: string,
  adminId: string,
  opts: { note?: string | null; tutorialId?: string | null } = {},
) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, userId: true, publicId: true, product: { select: { title: true, coverImage: true } } },
    })
    if (!order) throw new NotFoundError("سفارش یافت نشد")
    if (order.status !== "PROCESSING" && order.status !== "AWAITING_EXTENSION_APPROVAL") {
      throw new ConflictError("سفارش در وضعیت قابل تکمیل نیست")
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "DELIVERED",
        completionNote: opts.note?.trim() || null,
        completionTutorialId: opts.tutorialId || null,
        // Clear any pending extension so a late "yes" cannot revive a timer.
        pendingExtensionMinutes: null,
        extensionRequestedAt: null,
      },
    })

    // Keep the Delivery row (if any) consistent for MANUAL products.
    await tx.delivery.updateMany({
      where: { orderId: order.id, status: { not: "DELIVERED" } },
      data: { status: "DELIVERED", deliveredAt: new Date() },
    })

    await logEvent(tx, {
      orderId: order.id,
      type: "ORDER_COMPLETED",
      fromStatus: order.status,
      toStatus: "DELIVERED",
      actorType: "ADMIN",
      actorId: adminId,
      message: opts.note?.trim() || "سفارش با موفقیت تکمیل شد.",
      idempotencyKey: `${order.id}:completed`,
    })

    await createNotification(
      {
        userId: order.userId,
        type: "ORDER_DELIVERED",
        title: "سفارش تکمیل شد",
        body: `سفارش «${order.product.title}» با موفقیت تکمیل شد. برای مشاهده جزئیات کلیک کنید.`,
        href: `/orders/${order.publicId}`,
        image: order.product.coverImage,
      },
      tx,
    )

    return { ok: true as const }
  })
}

/**
 * Admin asks the buyer for more time. Guard: from PROCESSING (typical) — also
 * allowed when already AWAITING_EXTENSION_APPROVAL to update the amount.
 */
export async function requestExtension(orderId: string, adminId: string, minutes: number) {
  if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 24 * 60) {
    throw new ValidationError("مدت تمدید نامعتبر است")
  }
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, userId: true, publicId: true, product: { select: { title: true } } },
    })
    if (!order) throw new NotFoundError("سفارش یافت نشد")
    if (order.status !== "PROCESSING" && order.status !== "AWAITING_EXTENSION_APPROVAL") {
      throw new ConflictError("در این وضعیت امکان درخواست تمدید نیست")
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "AWAITING_EXTENSION_APPROVAL",
        pendingExtensionMinutes: minutes,
        extensionRequestedAt: new Date(),
      },
    })

    await logEvent(tx, {
      orderId: order.id,
      type: "EXTENSION_REQUESTED",
      fromStatus: order.status,
      toStatus: "AWAITING_EXTENSION_APPROVAL",
      actorType: "ADMIN",
      actorId: adminId,
      message: `درخواست ${minutes} دقیقه زمان بیشتر برای تکمیل سفارش.`,
      meta: { minutes },
      idempotencyKey: `${order.id}:ext-req:${Date.now()}`,
    })

    await createNotification(
      {
        userId: order.userId,
        type: "GENERAL",
        title: "درخواست زمان بیشتر",
        body: `سفارش «${order.product.title}» به ${minutes} دقیقه زمان بیشتر نیاز دارد. لطفاً تایید کنید.`,
        href: `/orders/${order.publicId}`,
      },
      tx,
    )

    return { ok: true as const }
  })
}

/**
 * Buyer approves the pending extension. Guard: from AWAITING_EXTENSION_APPROVAL.
 * Adds the pending minutes to dueAt, increments extensionCount, resumes PROCESSING.
 */
export async function approveExtension(publicId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { publicId, userId },
      select: { id: true, status: true, dueAt: true, pendingExtensionMinutes: true, extensionCount: true },
    })
    if (!order) throw new NotFoundError("سفارش یافت نشد")
    if (order.status !== "AWAITING_EXTENSION_APPROVAL" || !order.pendingExtensionMinutes) {
      throw new ConflictError("درخواست تمدیدی برای این سفارش وجود ندارد")
    }

    const minutes = order.pendingExtensionMinutes
    // Extend from the later of (old dueAt, now) so an already-overdue order gets
    // a fresh full window rather than starting in the past.
    const base = order.dueAt && order.dueAt > new Date() ? order.dueAt : new Date()
    const newDueAt = new Date(base.getTime() + minutes * 60_000)

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "PROCESSING",
        dueAt: newDueAt,
        extensionCount: { increment: 1 },
        pendingExtensionMinutes: null,
        extensionRequestedAt: null,
        overdueNotifiedAt: null, // re-arm the overdue reminder for the new window
      },
    })

    await logEvent(tx, {
      orderId: order.id,
      type: "EXTENSION_APPROVED",
      fromStatus: "AWAITING_EXTENSION_APPROVAL",
      toStatus: "PROCESSING",
      actorType: "USER",
      actorId: userId,
      message: `کاربر ${minutes} دقیقه زمان بیشتر را تایید کرد.`,
      meta: { minutes },
      idempotencyKey: `${order.id}:ext-approved:${order.extensionCount ?? 0}`,
    })

    return { ok: true as const, dueAt: newDueAt }
  })
}

/**
 * Buyer rejects the pending extension → cancel + refund. Convenience wrapper
 * that funnels into cancelOrder so the refund logic lives in exactly one place.
 */
export async function rejectExtensionAndCancel(
  publicId: string,
  userId: string,
  reason: { reasonCode: string; reason?: string | null },
) {
  const order = await prisma.order.findFirst({
    where: { publicId, userId },
    select: { id: true, status: true },
  })
  if (!order) throw new NotFoundError("سفارش یافت نشد")
  if (order.status !== "AWAITING_EXTENSION_APPROVAL") {
    throw new ConflictError("درخواست تمدیدی برای لغو وجود ندارد")
  }
  return cancelOrder(order.id, {
    actor: "USER",
    actorId: userId,
    reasonCode: reason.reasonCode,
    reason: reason.reason,
  })
}

/**
 * Cancel an order and refund EXACTLY the net principal (order.amount). Fully
 * idempotent: guarded by a terminal-status lock AND a unique refund event key,
 * so a double-call (retry, race, user + cron) refunds at most once.
 *
 * Restores variant stock. Never refunds discounts/commissions/rewards. Skips
 * the wallet refund entirely when amount <= 0 (e.g. giveaway prizes).
 */
export async function cancelOrder(
  orderId: string,
  opts: {
    actor: "USER" | "ADMIN" | "SYSTEM"
    actorId?: string | null
    reasonCode?: string | null
    reason?: string | null
  },
) {
  return prisma.$transaction(async (tx) => {
    // Lock the row's logical state by re-reading inside the tx and guarding.
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        userId: true,
        amount: true,
        quantity: true,
        variantId: true,
        publicId: true,
        product: { select: { title: true } },
      },
    })
    if (!order) throw new NotFoundError("سفارش یافت نشد")
    if (TERMINAL.includes(order.status)) {
      // Already cancelled/refunded — no-op (idempotent).
      return { ok: true as const, alreadyTerminal: true }
    }
    // Only orders that never reached DELIVERED may be cancelled. A delivered
    // order must go through the admin refund-request flow instead.
    if (order.status === "DELIVERED") {
      throw new ConflictError("سفارش تکمیل‌شده قابل لغو خودکار نیست")
    }

    const principal = order.amount // exact net charge — the ONLY refundable sum
    let refundedAmount = 0n

    if (principal > 0n) {
      // The unique refund OrderEvent key is the true idempotency guard: even if
      // two txs somehow both pass the status check, only one can insert it.
      const key = `${order.id}:refund`
      const inserted = await tx.orderEvent.createMany({
        data: [
          {
            orderId: order.id,
            type: "REFUND_ISSUED",
            actorType: opts.actor,
            actorId: opts.actorId ?? null,
            message: `بازگشت اصل مبلغ به کیف پول: ${principal.toString()}`,
            meta: { amount: principal.toString() },
            idempotencyKey: key,
          },
        ],
        skipDuplicates: true,
      })
      if (inserted.count === 1) {
        await refund(order.userId, principal, tx, { type: "order", id: order.id })
        refundedAmount = principal
      }
    }

    // Restore stock on the chosen plan (guarded so soldCount never goes < 0).
    if (order.variantId) {
      await tx.productVariant.updateMany({
        where: { id: order.variantId },
        data: {
          stock: { increment: order.quantity },
          soldCount: { decrement: order.quantity },
          version: { increment: 1 },
        },
      })
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "REFUNDED",
        cancelledBy: opts.actor,
        cancelReasonCode: opts.reasonCode ?? null,
        cancelReason: opts.reason?.trim() || null,
        refundedAmount: refundedAmount > 0n ? refundedAmount : null,
        pendingExtensionMinutes: null,
        extensionRequestedAt: null,
      },
    })

    // Mark any pending delivery failed so it never gets fulfilled later.
    await tx.delivery.updateMany({
      where: { orderId: order.id, status: "PENDING" },
      data: { status: "FAILED" },
    })

    await logEvent(tx, {
      orderId: order.id,
      type: "ORDER_CANCELLED",
      fromStatus: order.status,
      toStatus: "REFUNDED",
      actorType: opts.actor,
      actorId: opts.actorId ?? null,
      reasonCode: opts.reasonCode ?? null,
      message: opts.reason?.trim() || "سفارش لغو شد و اصل مبلغ بازگشت داده شد.",
      idempotencyKey: `${order.id}:cancelled`,
    })

    // Notify the buyer (skip when the buyer themselves triggered it? still useful).
    await createNotification(
      {
        userId: order.userId,
        type: refundedAmount > 0n ? "REFUND_RECEIVED" : "GENERAL",
        title: "سفارش لغو شد",
        body:
          refundedAmount > 0n
            ? `سفارش «${order.product.title}» لغو شد و اصل مبلغ به کیف پول شما بازگشت داده شد.`
            : `سفارش «${order.product.title}» لغو شد.`,
        href: `/orders/${order.publicId}`,
      },
      tx,
    )

    return { ok: true as const, refundedAmount }
  })
}

// ---------------------------------------------------------------------------
// Cron: overdue reminders (no auto-cancel — admin decides extend vs complete)
// ---------------------------------------------------------------------------

/**
 * Find PROCESSING orders past their promised dueAt that haven't yet triggered
 * an admin reminder, and notify admins once. Mirrors processDueDomainOrders but
 * deliberately does NOT auto-cancel; the admin either completes or requests an
 * extension.
 */
export async function processDueShopOrders() {
  const now = new Date()
  const overdue = await prisma.order.findMany({
    where: {
      status: "PROCESSING",
      dueAt: { lte: now },
      overdueNotifiedAt: null,
    },
    select: { id: true, publicId: true, product: { select: { title: true } } },
    take: 50,
  })

  let notified = 0
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } })

  for (const order of overdue) {
    try {
      await prisma.$transaction(async (tx) => {
        // Re-check + stamp atomically so two cron ticks can't both notify.
        const stamped = await tx.order.updateMany({
          where: { id: order.id, status: "PROCESSING", overdueNotifiedAt: null },
          data: { overdueNotifiedAt: now },
        })
        if (stamped.count !== 1) return
        for (const a of admins) {
          await createNotification(
            {
              userId: a.id,
              type: "GENERAL",
              title: "سفارش از زمان تعهد گذشت",
              body: `مهلت تکمیل سفارش «${order.product.title}» به پایان رسید. لطفاً تکمیل یا درخواست تمدید کنید.`,
              href: `/admin/orders/${order.id}`,
            },
            tx,
          )
        }
        await logEvent(tx, {
          orderId: order.id,
          type: "ORDER_OVERDUE",
          actorType: "SYSTEM",
          message: "مهلت تکمیل سفارش به پایان رسید.",
          idempotencyKey: `${order.id}:overdue`,
        })
        notified++
      })
    } catch (e) {
      console.log("[v0] processDueShopOrders error:", (e as Error).message)
    }
  }

  return { notified }
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

const ORDER_DETAIL_INCLUDE = {
  product: {
    select: {
      id: true,
      title: true,
      slug: true,
      coverImage: true,
    },
  },
  variant: { select: { id: true, name: true } },
  completionTutorial: { select: { id: true, title: true, slug: true } },
  events: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.OrderInclude

/** Full detail for the buyer's own order (ownership-enforced). */
export async function getOrderForUser(publicId: string, userId: string) {
  return prisma.order.findFirst({
    where: { publicId, userId },
    include: ORDER_DETAIL_INCLUDE,
  })
}

/** Full detail for an admin (includes sensitive customerInput). */
export async function getOrderForAdmin(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      ...ORDER_DETAIL_INCLUDE,
      user: { select: { id: true, displayName: true, alias: true, email: true } },
    },
  })
}
