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
import { getOrderPaymentReport } from "./order-report"
import {
  computeDomainProgress,
  computeShopRoadmap,
  deriveOrderCategory,
  type AdminDomainOrderDetail,
  type AdminDomainOrderListItem,
  type AdminOrderDetail,
  type AdminOrderListItem,
  type OrderDetail,
  type OrderListItem,
  type OrderUserRef,
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

const ADMIN_LIST_INCLUDE = {
  product: { select: { title: true, coverImage: true } },
  ...ADMIN_USER_SELECT,
  // Delivery status drives the manual-fulfilment queue + fulfillmentKind badge.
  delivery: { select: { status: true } },
} satisfies Prisma.OrderInclude
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

/** Terminal statuses have no fulfilment work left. */
function isTerminalStatus(status: string): boolean {
  return status === "DELIVERED" || status === "REFUNDED" || status === "CANCELLED"
}

/**
 * Classify how a shop/auction order is fulfilled. ROADMAP wins when the order
 * carries the multi-step customer-input flow; otherwise a non-terminal order
 * with a delivery row is MANUAL; auctions map to AUCTION; delivered/refunded
 * orders report NONE.
 */
function deriveFulfillmentKind(o: {
  status: string
  type: string
  requiresCustomerInput: boolean
}): AdminOrderListItem["fulfillmentKind"] {
  if (o.requiresCustomerInput) return "ROADMAP"
  if (isTerminalStatus(o.status)) return "NONE"
  if (o.type === "AUCTION_WIN" || o.type === "AUCTION") return "AUCTION"
  return "MANUAL"
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
    fulfillmentKind: deriveFulfillmentKind({
      status: o.status,
      type: o.type,
      requiresCustomerInput: o.requiresCustomerInput,
    }),
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
    fulfillmentKind: deriveFulfillmentKind({
      status: o.status,
      type: o.type,
      requiresCustomerInput: o.requiresCustomerInput,
    }),
    // Filled in by getShopOrderDetailForAdmin (async assembler).
    report: null,
  }
}

export interface AdminOrderQuery {
  /** "active" = fulfilment work queue; "all" = every shop/auction order. */
  scope?: "active" | "all"
  /** Free-text search: order publicId OR buyer alias/email/displayName. */
  q?: string
  /** Category filter. DOMAIN is served separately (see listDomainOrdersForAdmin). */
  category?: "SHOP" | "AUCTION"
}

/**
 * Orders relevant to admin fulfilment, filterable for the unified console.
 *
 * The ACTIVE queue is the fulfilment work list: roadmap states
 * (AWAITING_CUSTOMER_INPUT / PROCESSING / AWAITING_EXTENSION_APPROVAL) PLUS
 * manual-delivery work — PAID orders whose delivery row is still PENDING/FAILED.
 * Overdue PROCESSING orders float to the top of the active queue.
 */
export async function listShopOrdersForAdmin(
  query: AdminOrderQuery = {},
): Promise<AdminOrderListItem[]> {
  const { scope = "active", q, category } = query

  const and: Prisma.OrderWhereInput[] = []

  if (scope === "active") {
    // Roadmap work OR pending/failed manual delivery.
    and.push({
      OR: [
        { status: { in: ["AWAITING_CUSTOMER_INPUT", "PROCESSING", "AWAITING_EXTENSION_APPROVAL"] } },
        { status: "PAID", delivery: { status: { in: ["PENDING", "FAILED"] } } },
      ],
    })
  }

  if (category === "AUCTION") and.push({ type: "AUCTION_WIN" })
  else if (category === "SHOP") and.push({ type: { in: ["FIXED_PURCHASE", "BUY_NOW"] } })

  const term = q?.trim()
  if (term) {
    and.push({
      OR: [
        { publicId: { contains: term, mode: "insensitive" } },
        { user: { alias: { contains: term, mode: "insensitive" } } },
        { user: { email: { contains: term, mode: "insensitive" } } },
        { user: { displayName: { contains: term, mode: "insensitive" } } },
      ],
    })
  }

  const where: Prisma.OrderWhereInput = and.length ? { AND: and } : {}

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
  if (!order) return null
  const detail = toAdminDetail(order)
  detail.report = await getOrderPaymentReport(order.id)
  return detail
}

// --- Domain orders (Phase 4) -------------------------------------------------

type DomainOrderRow = Prisma.DomainOrderGetPayload<Record<string, never>>

/**
 * Map a DomainOrder into the unified OrderListItem shape so it can sit in the
 * Orders page DOMAIN tab. Domains keep their own detail flow, so `href` points
 * at the existing /domains page rather than the shop detail route.
 */
function domainToListItem(d: DomainOrderRow): OrderListItem {
  return {
    id: d.id,
    publicId: d.publicId,
    title: d.unicodeDomain,
    coverImage: null,
    category: "DOMAIN",
    type: d.operation,
    status: d.status,
    amount: Number(d.amountIrt),
    quantity: 1,
    createdAt: d.createdAt.toISOString(),
    isGiveawayPrize: false,
    requiresCustomerInput: d.status === "AWAITING_NAMESERVERS",
    progress: computeDomainProgress(d.status),
    dueAt: null,
    pendingExtensionMinutes: null,
    href: "/domains",
  }
}

/** A user's domain orders as unified list items for the DOMAIN tab. */
export async function listDomainOrdersForUser(userId: string): Promise<OrderListItem[]> {
  const orders = await prisma.domainOrder.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
  return orders.map(domainToListItem)
}

// --- Admin domain serializers (unified console) ------------------------------
// DomainOrder.userId is a scalar (no Prisma relation, backup-safe), so buyer
// identities are resolved with a separate batched User query and joined in JS.

const EMPTY_USER: OrderUserRef = { id: "", displayName: null, alias: null, email: null }

function nameserversOf(d: { ns1: string | null; ns2: string | null; ns3: string | null; ns4: string | null }): string[] {
  return [d.ns1, d.ns2, d.ns3, d.ns4].filter((n): n is string => Boolean(n && n.trim()))
}

/** Batch-load buyer identities for a set of userIds, keyed by id. */
async function loadUserRefs(userIds: string[]): Promise<Map<string, OrderUserRef>> {
  const unique = [...new Set(userIds)]
  if (unique.length === 0) return new Map()
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, displayName: true, alias: true, email: true },
  })
  return new Map(users.map((u) => [u.id, u]))
}

/**
 * Domain orders for the unified admin console, with the same "active" work-queue
 * semantics and free-text search (domain / order code / buyer) as shop orders.
 */
export async function listDomainOrdersForAdmin(
  query: { scope?: "active" | "all"; q?: string } = {},
): Promise<AdminDomainOrderListItem[]> {
  const { scope = "active", q } = query
  const and: Prisma.DomainOrderWhereInput[] = []

  if (scope === "active") {
    and.push({
      status: { in: ["PENDING_PURCHASE", "PROCESSING", "AWAITING_NAMESERVERS", "AWAITING_NAMESERVER_SETUP"] },
    })
  }

  const term = q?.trim()
  if (term) {
    // Buyer match: userId has no relation, so resolve matching user ids first.
    const matchedUsers = await prisma.user.findMany({
      where: {
        OR: [
          { alias: { contains: term, mode: "insensitive" } },
          { email: { contains: term, mode: "insensitive" } },
          { displayName: { contains: term, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    })
    and.push({
      OR: [
        { unicodeDomain: { contains: term, mode: "insensitive" } },
        { asciiDomain: { contains: term, mode: "insensitive" } },
        { publicId: { contains: term, mode: "insensitive" } },
        { userId: { in: matchedUsers.map((u) => u.id) } },
      ],
    })
  }

  const orders = await prisma.domainOrder.findMany({
    where: and.length ? { AND: and } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
  })
  const userMap = await loadUserRefs(orders.map((o) => o.userId))

  return orders.map((d) => ({
    id: d.id,
    publicId: d.publicId,
    domain: d.unicodeDomain,
    operation: d.operation,
    status: d.status,
    amount: Number(d.amountIrt),
    progress: computeDomainProgress(d.status),
    createdAt: d.createdAt.toISOString(),
    user: userMap.get(d.userId) ?? EMPTY_USER,
    hasNameservers: nameserversOf(d).length > 0,
    fulfillmentKind: "DOMAIN" as const,
  }))
}

/** Full admin detail for a single domain order (NS + events). Null if absent. */
export async function getDomainOrderForAdmin(orderId: string): Promise<AdminDomainOrderDetail | null> {
  const d = await prisma.domainOrder.findUnique({
    where: { id: orderId },
    include: { events: { orderBy: { createdAt: "asc" } } },
  })
  if (!d) return null
  const userMap = await loadUserRefs([d.userId])
  return {
    id: d.id,
    publicId: d.publicId,
    domain: d.unicodeDomain,
    asciiDomain: d.asciiDomain,
    tld: d.tld,
    operation: d.operation,
    status: d.status,
    amount: Number(d.amountIrt),
    createdAt: d.createdAt.toISOString(),
    purchasedAt: d.purchasedAt?.toISOString() ?? null,
    holdExpiresAt: d.holdExpiresAt?.toISOString() ?? null,
    expiresAt: d.expiresAt?.toISOString() ?? null,
    extensionCount: d.extensionCount,
    failureReason: d.failureReason,
    user: userMap.get(d.userId) ?? EMPTY_USER,
    nameservers: nameserversOf(d),
    nameserversSubmittedAt: d.nameserversSubmittedAt?.toISOString() ?? null,
    events: d.events.map((e) => ({
      type: e.type,
      message: e.message,
      actorType: e.actorType,
      createdAt: e.createdAt.toISOString(),
    })),
  }
}
