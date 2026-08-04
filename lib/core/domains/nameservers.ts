import "server-only"
import { randomBytes } from "node:crypto"
import { prisma } from "@/lib/db"
import { ConflictError, NotFoundError, ValidationError } from "@/lib/core/errors"

/**
 * Repeatable, admin-approved nameserver change requests (decoupled from the
 * order lifecycle). The buyer may submit/replace NS any time after the domain
 * is registered; each submission supersedes the prior PENDING request for the
 * same order and creates a fresh PENDING one for an admin to apply.
 *
 * Flow:
 *   submitNsRequest (USER)  -> PENDING  (+ admin notification)
 *   completeNsRequest(ADMIN)-> COMPLETED(applies NS to OwnedDomain + notifies buyer)
 *   rejectNsRequest (ADMIN) -> REJECTED (+ notifies buyer)
 */

function nsPublicId() {
  return `NS-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`
}

/**
 * Buyer submits (or replaces) the nameservers for a registered domain order.
 * Requires the order to be COMPLETED (domain owned). Supersedes any existing
 * PENDING request for the same order so the admin queue never shows stale duplicates.
 */
export async function submitNsRequest(
  userId: string,
  orderPublicId: string,
  nameservers: [string, string, string?, string?],
) {
  const [ns1, ns2, ns3, ns4] = nameservers
  if (!ns1 || !ns2) throw new ValidationError("حداقل NS1 و NS2 الزامی است.")
  return prisma.$transaction(async (tx) => {
    const order = await tx.domainOrder.findFirst({
      where: { publicId: orderPublicId, userId },
      include: { ownedDomain: true },
    })
    if (!order) throw new NotFoundError("سفارش دامنه یافت نشد.")
    if (order.status !== "COMPLETED" || !order.ownedDomain) {
      throw new ConflictError("ثبت NS فقط پس از تکمیل خرید دامنه امکان‌پذیر است.")
    }
    // Supersede any open request for this order.
    await tx.domainNsRequest.updateMany({
      where: { orderId: order.id, status: "PENDING" },
      data: { status: "CANCELLED", note: "با ارسال درخواست جدید جایگزین شد.", resolvedAt: new Date() },
    })
    const request = await tx.domainNsRequest.create({
      data: {
        publicId: nsPublicId(),
        orderId: order.id,
        userId,
        asciiDomain: order.asciiDomain,
        ns1,
        ns2,
        ns3: ns3 || null,
        ns4: ns4 || null,
        status: "PENDING",
      },
    })
    await tx.domainOrderEvent.create({
      data: {
        orderId: order.id,
        operation: order.operation,
        type: "NAMESERVERS_SUBMITTED",
        fromStatus: order.status,
        toStatus: order.status,
        actorType: "USER",
        actorId: userId,
        message: "کاربر درخواست ثبت/تغییر NS ارسال کرد؛ در انتظار اقدام مدیر.",
        meta: { ns1, ns2, ns3: ns3 || null, ns4: ns4 || null },
        idempotencyKey: `${order.id}:ns-req:${request.id}`,
      },
    })
    const admins = await tx.user.findMany({ where: { role: "ADMIN" }, select: { id: true } })
    if (admins.length) {
      await tx.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: "GENERAL" as const,
          title: "درخواست تغییر NS",
          body: `کاربر برای ${order.asciiDomain} درخواست ثبت/تغییر نیم‌سرور ارسال کرد.`,
          href: "/admin/domains/nameservers",
        })),
      })
    }
    return request
  })
}

/**
 * Admin applies a pending request: writes the NS onto the owned domain and marks
 * the request COMPLETED, notifying the buyer that their nameservers changed.
 */
export async function completeNsRequest(requestId: string, adminId: string) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.domainNsRequest.findUnique({
      where: { id: requestId },
      include: { order: true },
    })
    if (!request) throw new NotFoundError("درخواست NS یافت نشد.")
    if (request.status !== "PENDING") throw new ConflictError("این درخواست قبلاً تعیین تکلیف شده است.")
    const now = new Date()
    const updated = await tx.domainNsRequest.update({
      where: { id: request.id },
      data: { status: "COMPLETED", resolvedBy: adminId, resolvedAt: now },
    })
    await tx.ownedDomain.updateMany({
      where: { orderId: request.orderId },
      data: { ns1: request.ns1, ns2: request.ns2, ns3: request.ns3, ns4: request.ns4, nsUpdatedAt: now },
    })
    await tx.domainOrderEvent.create({
      data: {
        orderId: request.orderId,
        operation: request.order.operation,
        type: "NAMESERVERS_CONFIGURED",
        fromStatus: request.order.status,
        toStatus: request.order.status,
        actorType: "ADMIN",
        actorId: adminId,
        message: "نیم‌سرورهای درخواست‌شده توسط مدیر ثبت شد.",
        meta: { ns1: request.ns1, ns2: request.ns2, ns3: request.ns3, ns4: request.ns4 },
        idempotencyKey: `${request.orderId}:ns-done:${request.id}`,
      },
    })
    await tx.notification.create({
      data: {
        userId: request.userId,
        type: "GENERAL",
        title: "نیم‌سرورهای دامنه تغییر کرد",
        body: `NSهای ${request.asciiDomain} با موفقیت ثبت شد.`,
        href: `/orders/domain/${request.order.publicId}`,
      },
    })
    return updated
  })
}

/**
 * Admin rejects a pending request with an optional reason; notifies the buyer so
 * they can resubmit corrected nameservers.
 */
export async function rejectNsRequest(requestId: string, adminId: string, note?: string) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.domainNsRequest.findUnique({
      where: { id: requestId },
      include: { order: { select: { publicId: true } } },
    })
    if (!request) throw new NotFoundError("درخواست NS یافت نشد.")
    if (request.status !== "PENDING") throw new ConflictError("این درخواست قبلاً تعیین تکلیف شده است.")
    const updated = await tx.domainNsRequest.update({
      where: { id: request.id },
      data: { status: "REJECTED", resolvedBy: adminId, resolvedAt: new Date(), note: note?.trim() || null },
    })
    await tx.notification.create({
      data: {
        userId: request.userId,
        type: "GENERAL",
        title: "درخواست تغییر NS رد شد",
        body: note?.trim()
          ? `درخواست NS برای ${request.asciiDomain} رد شد: ${note.trim()}`
          : `درخواست NS برای ${request.asciiDomain} رد شد. لطفاً مقادیر را بررسی و دوباره ارسال کنید.`,
        href: `/orders/domain/${request.order.publicId}`,
      },
    })
    return updated
  })
}
