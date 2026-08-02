/**
 * Server-side serializers that turn raw `Order` rows into the client-facing
 * view models declared in `lib/orders/shared.ts`. Kept separate from the
 * lifecycle service (which mutates) and from catalog (to avoid import cycles).
 *
 * SECURITY: the list serializer NEVER includes the buyer's submitted account
 * info (`customerInput`). The detail serializer returns those values ONLY for
 * the owning buyer (ownership is enforced by the query), rendered masked in the
 * UI. Admin reveal is a separate, access-controlled path (Phase 3).
 */

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { resolveTemplate, type DeliveryTemplate } from "./delivery-fields"
import {
  computeShopRoadmap,
  deriveOrderCategory,
  type AdminOrderDetail,
  type AdminOrderListItem,
  type OrderDetail,
  type OrderListItem,
} from "@/lib/orders/shared"

// --- Prisma include shapes ---------------------------------------------------

const LIST_INCLUDE = {
  product: { select: { title: true, coverImage: true } },
} satisfies Prisma.OrderInclude

const DETAIL_INCLUDE = {
  product: { select: { id: true, title: true, slug: true, coverImage: true, deliveryFields: true } },
  variant: { select: { id: true, name: true, deliveryFields: true } },
  completionTutorial: { select: { id: true, title: true, slug: true } },
  delivery: {
    include: {
      tutorial: { select: { id: true, title: true, slug: true } },
      inventoryItem: { select: { totpSecret: { select: { id: true } } } },
    },
  },
  events: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.OrderInclude

const ADMIN_USER_SELECT = {
  user: { select: { id: true, displayName: true, alias: true, email: true } },
} satisfies Prisma.OrderInclude

const ADMIN_LIST_INCLUDE = { ...LIST_INCLUDE, ...ADMIN_USER_SELECT } satisfies Prisma.OrderInclude
const ADMIN_DETAIL_INCLUDE = {
  ...DETAIL_INCLUDE,
  ...ADMIN_USER_SELECT,
  product: {
    select: {
      id: true,
      title: true,
      slug: true,
      coverImage: true,
      deliveryFields: true,
      avgCompletionMinutes: true,
    },
  },
} satisfies Prisma.OrderInclude

type ListOrder = Prisma.OrderGetPayload<{ include: typeof LIST_INCLUDE }>
type DetailOrder = Prisma.OrderGetPayload<{ include: typeof DETAIL_INCLUDE }>
type AdminListOrder = Prisma.OrderGetPayload<{ include: typeof ADMIN_LIST_INCLUDE }>
type AdminDetailOrder = Prisma.OrderGetPayload<{ include: typeof ADMIN_DETAIL_INCLUDE }>

// --- helpers -----------------------------------------------------------------

function customerInputSubmitted(o: { status: string; customerInputAt: Date | null }): boolean {
  return o.customerInputAt != null
}

function toListItem(o: ListOrder): OrderListItem {
  const { progress } = computeShopRoadmap({
    status: o.status,
    requiresCustomerInput: o.requiresCustomerInput,
    customerInputSubmitted: o.customerInputAt != null,
  })
  return {
    id: o.id,
    publicId: o.publicId,
    title: o.product.title,
    coverImage: o.product.coverImage,
    category: deriveOrderCategory(o.type),
    type: o.type,
    status: o.status,
    amount: Number(o.amount),
    quantity: o.quantity,
    createdAt: o.createdAt.toISOString(),
    isGiveawayPrize: o.isGiveawayPrize,
    requiresCustomerInput: o.requiresCustomerInput,
    progress,
    dueAt: o.status === "PROCESSING" && o.dueAt ? o.dueAt.toISOString() : null,
    pendingExtensionMinutes: o.pendingExtensionMinutes,
    href: `/orders/${o.publicId}`,
  }
}

function toDetail(o: DetailOrder): OrderDetail {
  const base = toListItem(o as unknown as ListOrder)
  const { roadmap } = computeShopRoadmap({
    status: o.status,
    requiresCustomerInput: o.requiresCustomerInput,
    customerInputSubmitted: o.customerInputAt != null,
  })

  // Template for the customer-input step: snapshot on the order (immutable),
  // falling back to the live resolution only for legacy orders without one.
  const snapshot = o.customerInputFields
  const customerInputTemplate: DeliveryTemplate | null = o.requiresCustomerInput
    ? resolveTemplate(o.product.deliveryFields, snapshot ?? o.variant?.deliveryFields ?? null)
    : null

  // Owner-only echo of the buyer's own submitted values (masked in UI).
  const submitted = customerInputSubmitted(o)
  const customerInputValues =
    submitted && o.customerInput && typeof o.customerInput === "object" && !Array.isArray(o.customerInput)
      ? (o.customerInput as Record<string, string>)
      : null

  const deliveredPayload =
    o.delivery && o.delivery.status === "DELIVERED" ? (o.delivery.payload as Record<string, unknown> | string | null) : null

  return {
    ...base,
    variantName: o.variant?.name ?? null,
    roadmap,
    customerInputTemplate,
    customerInputSubmitted: submitted,
    customerInputValues,
    estimatedMinutes: o.estimatedMinutes,
    processingStartedAt: o.processingStartedAt?.toISOString() ?? null,
    dueAt: o.dueAt?.toISOString() ?? null, // full dueAt (detail timer needs it in all states)
    extensionCount: o.extensionCount,
    completionNote: o.completionNote,
    completionTutorial: o.completionTutorial
      ? { title: o.completionTutorial.title, href: `/tutorials/${o.completionTutorial.slug}` }
      : null,
    delivery: o.delivery
      ? {
          id: o.delivery.id,
          status: o.delivery.status,
          payload: deliveredPayload,
          template: resolveTemplate(o.product.deliveryFields, o.variant?.deliveryFields ?? null),
          has2fa: o.delivery.status === "DELIVERED" && Boolean(o.delivery.inventoryItem?.totpSecret),
          error: o.delivery.error,
        }
      : null,
    cancelReason: o.cancelReason,
    cancelReasonCode: o.cancelReasonCode,
    refundedAmount: o.refundedAmount != null ? Number(o.refundedAmount) : null,
    events: o.events.map((e) => ({
      type: e.type,
      message: e.message,
      actorType: e.actorType,
      createdAt: e.createdAt.toISOString(),
    })),
  }
}

// --- public API --------------------------------------------------------------

/** All of a user's shop/auction orders as lean list items (no sensitive data). */
export async function listShopOrdersForUser(userId: string): Promise<OrderListItem[]> {
  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: LIST_INCLUDE,
  })
  return orders.map(toListItem)
}

/** Full detail for the buyer's own order (ownership-enforced). Null if absent. */
export async function getShopOrderDetailForUser(publicId: string, userId: string): Promise<OrderDetail | null> {
  const order = await prisma.order.findFirst({
    where: { publicId, userId },
    include: DETAIL_INCLUDE,
  })
  return order ? toDetail(order) : null
}

// --- Admin serializers -------------------------------------------------------

function isOverdue(o: { status: string; dueAt: Date | null }): boolean {
  return o.status === "PROCESSING" && o.dueAt != null && o.dueAt.getTime() < Date.now()
}

function toAdminListItem(o: AdminListOrder): AdminOrderListItem {
  return {
    ...toListItem(o as unknown as ListOrder),
    user: {
      id: o.user.id,
      displayName: o.user.displayName,
      alias: o.user.alias,
      email: o.user.email,
    },
    overdue: isOverdue(o),
    extensionCount: o.extensionCount,
    pendingExtensionMinutes: o.pendingExtensionMinutes,
  }
}

function toAdminDetail(o: AdminDetailOrder): AdminOrderDetail {
  const base = toDetail(o as unknown as DetailOrder)
  // Admins always see the submitted account info (guarded by requireAdmin at
  // the route). If the buyer submitted values, echo them regardless of owner.
  const values =
    o.customerInput && typeof o.customerInput === "object" && !Array.isArray(o.customerInput)
      ? (o.customerInput as Record<string, string>)
      : null
  return {
    ...base,
    customerInputValues: values,
    user: {
      id: o.user.id,
      displayName: o.user.displayName,
      alias: o.user.alias,
      email: o.user.email,
    },
    overdue: isOverdue(o),
    avgCompletionMinutes: o.product.avgCompletionMinutes ?? null,
  }
}

/**
 * Orders relevant to admin fulfilment. `scope`:
 *  - "active" (default): orders awaiting input, processing, or awaiting the
 *    buyer's extension decision — i.e. the fulfilment work queue.
 *  - "all": every shop/auction order (most recent first).
 * Overdue PROCESSING orders float to the top of the active queue.
 */
export async function listShopOrdersForAdmin(
  scope: "active" | "all" = "active",
): Promise<AdminOrderListItem[]> {
  const where: Prisma.OrderWhereInput =
    scope === "active"
      ? { status: { in: ["AWAITING_CUSTOMER_INPUT", "PROCESSING", "AWAITING_EXTENSION_APPROVAL"] } }
      : {}
  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: ADMIN_LIST_INCLUDE,
    take: 200,
  })
  const items = orders.map(toAdminListItem)
  if (scope === "active") {
    // Overdue first, then by soonest due, then newest.
    items.sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
      const ad = a.dueAt ? Date.parse(a.dueAt) : Infinity
      const bd = b.dueAt ? Date.parse(b.dueAt) : Infinity
      return ad - bd
    })
  }
  return items
}

/** Full admin detail (always reveals submitted account info). Null if absent. */
export async function getShopOrderDetailForAdmin(orderId: string): Promise<AdminOrderDetail | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: ADMIN_DETAIL_INCLUDE,
  })
  return order ? toAdminDetail(order) : null
}
