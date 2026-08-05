/**
 * Client-safe STRUCTURAL types and logic for the unified Orders experience.
 * Imported by both server serializers (lib/core/order-views.ts) and client
 * components (orders list + detail). Intentionally text-free: every
 * user-facing string is localized in `lib/i18n/order-copy.ts` and selected by
 * the component from `key`/`status`/`code` values produced here.
 *
 * Free of server-only imports.
 */

import type { DeliveryTemplate } from "@/lib/core/delivery-fields"

/** Top-level buckets shown as tabs on the Orders page. */
export type OrderCategory = "SHOP" | "AUCTION" | "DOMAIN" | "VPS"

/** Display order of category tabs on the orders page. */
export const ORDER_CATEGORIES: OrderCategory[] = ["SHOP", "AUCTION", "DOMAIN", "VPS"]

/** Order of the tabs on the page. */
export const CATEGORY_ORDER: OrderCategory[] = ["SHOP", "AUCTION", "DOMAIN", "VPS"]

/** State of a single node in a roadmap/stepper. */
export type StepState = "done" | "active" | "upcoming" | "cancelled"

/**
 * Stable, localizable roadmap step identifiers.
 * `payment|input|processing|complete` drive the shop-product roadmap.
 * `domain_*` drive the domain-order roadmap (purchase → admin registers → done).
 */
export type StepKey =
  | "payment"
  | "input"
  | "processing"
  | "complete"
  | "domain_paid"
  | "domain_register"
  | "domain_done"

export interface RoadmapStep {
  key: StepKey
  state: StepState
}

/** Semantic tone driving the color of a status chip. */
export type StatusTone = "neutral" | "info" | "progress" | "success" | "danger" | "warning"

/** Canonical tone per status string (shop + domain), for uniform coloring. */
export const STATUS_TONE: Record<string, StatusTone> = {
  PENDING: "warning",
  PAID: "info",
  AWAITING_CUSTOMER_INPUT: "warning",
  PROCESSING: "progress",
  AWAITING_EXTENSION_APPROVAL: "warning",
  DELIVERED: "success",
  COMPLETED: "success",
  REFUNDED: "neutral",
  CANCELLED: "danger",
  FAILED: "danger",
  // Domain lifecycle (Phase 4)
  PENDING_PURCHASE: "warning",
  AWAITING_NAMESERVERS: "warning",
  AWAITING_NAMESERVER_SETUP: "progress",
  EXPIRED: "danger",
}

export function statusTone(status: string): StatusTone {
  return STATUS_TONE[status] ?? "neutral"
}

/**
 * Derive the category bucket for a shop/auction Order. Domain orders are tagged
 * DOMAIN explicitly by their own serializer. Giveaway prizes stay under SHOP
 * (with a separate قرعه‌کشی tag), per product decision.
 */
export function deriveOrderCategory(type: string): OrderCategory {
  if (type === "AUCTION_WIN" || type === "AUCTION") return "AUCTION"
  return "SHOP"
}

/** Terminal states where no further roadmap progress is possible. */
export function isCancelledStatus(status: string): boolean {
  return status === "CANCELLED" || status === "REFUNDED" || status === "FAILED" || status === "EXPIRED"
}

export function isCompleteStatus(status: string): boolean {
  return status === "DELIVERED" || status === "COMPLETED"
}

/**
 * Compute the ordered roadmap steps + progress for a SHOP order from its
 * minimal state. Pure and deterministic (same result on server and client).
 *  - requiresCustomerInput: payment → input → processing → complete
 *  - instant (AUTOMATIC/simple): payment → complete
 * Cancelled/refunded orders mark the reached step as `cancelled`.
 */
export function computeShopRoadmap(input: {
  status: string
  requiresCustomerInput: boolean
  customerInputSubmitted: boolean
}): { roadmap: RoadmapStep[]; progress: number } {
  const { status, requiresCustomerInput, customerInputSubmitted } = input
  const cancelled = isCancelledStatus(status)
  const complete = isCompleteStatus(status)

  if (!requiresCustomerInput) {
    const steps: RoadmapStep[] = [
      { key: "payment", state: "done" },
      { key: "complete", state: cancelled ? "cancelled" : complete ? "done" : "active" },
    ]
    return { roadmap: steps, progress: cancelled ? 0 : complete ? 100 : 50 }
  }

  const inputDone =
    customerInputSubmitted ||
    status === "PROCESSING" ||
    status === "AWAITING_EXTENSION_APPROVAL" ||
    complete
  const processingActive = status === "PROCESSING" || status === "AWAITING_EXTENSION_APPROVAL"

  // On a terminal failure exactly ONE node turns red: the furthest node the
  // order actually reached. Everything past it stays `upcoming`, since painting
  // later nodes red showed their success copy under a failure icon.
  const failedKey: StepKey | null = cancelled ? (inputDone ? "processing" : "input") : null

  const steps: RoadmapStep[] = [
    { key: "payment", state: "done" },
    {
      key: "input",
      state:
        failedKey === "input"
          ? "cancelled"
          : inputDone
            ? "done"
            : status === "AWAITING_CUSTOMER_INPUT"
              ? "active"
              : "upcoming",
    },
    {
      key: "processing",
      state: failedKey === "processing" ? "cancelled" : complete ? "done" : processingActive ? "active" : "upcoming",
    },
    {
      key: "complete",
      state: complete ? "done" : "upcoming",
    },
  ]

  const doneCount = steps.filter((s) => s.state === "done").length
  const progress = Math.round((doneCount / steps.length) * 100)
  return { roadmap: steps, progress }
}

/**
 * Progress (0..100) for a DOMAIN order. Domains have their own lifecycle:
 * pending payment → processing → awaiting/configuring nameservers → completed.
 * Terminal failure/expiry/cancel report 0. Pure + deterministic.
 */
export function computeDomainProgress(status: string): number {
  if (isCompleteStatus(status)) return 100
  if (isCancelledStatus(status)) return 0
  switch (status) {
    case "PENDING_PURCHASE":
      return 15
    case "PROCESSING":
      return 45
    case "AWAITING_NAMESERVERS":
      return 65
    case "AWAITING_NAMESERVER_SETUP":
      return 85
    default:
      return 30
  }
}

/**
 * Ordered roadmap for a DOMAIN order (product-parity stepper). Three nodes:
 *   1) پرداخت انجام شد (funds frozen — always done once an order exists)
 *   2) خرید توسط مدیر (admin registers the domain)
 *   3) دامنه فعال شد (COMPLETED)
 * Terminal failure/expiry/cancel marks ONLY the node the order stopped on as
 * `cancelled`; later nodes stay `upcoming` because they were never reached.
 * Marking them cancelled too used to render "دامنه با موفقیت ثبت شد" under a red
 * failure icon — the copy and the icon contradicted each other.
 * Pure + deterministic (same result on server + client).
 */
export function computeDomainRoadmap(status: string): RoadmapStep[] {
  const complete = isCompleteStatus(status)
  const cancelled = isCancelledStatus(status)
  return [
    { key: "domain_paid", state: "done" },
    {
      key: "domain_register",
      state: complete ? "done" : cancelled ? "cancelled" : "active",
    },
    {
      key: "domain_done",
      state: complete ? "done" : "upcoming",
    },
  ]
}

/** Tone per NS-request status, for uniform chip coloring. */
export const NS_REQUEST_TONE: Record<string, StatusTone> = {
  PENDING: "warning",
  COMPLETED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
}

/** Standard cancellation reason codes. `OTHER` reveals a free-text field. */
export const CANCEL_REASON_CODES = [
  "BUYING_ELSEWHERE",
  "IN_A_HURRY",
  "CHANGED_MIND",
  "TOO_LONG",
  "OTHER",
] as const
export type CancelReasonCode = (typeof CANCEL_REASON_CODES)[number]

// ---------------------------------------------------------------------------
// Shared view-model shapes (server → client). Text-free: the client localizes.
// ---------------------------------------------------------------------------

export interface OrderListItem {
  id: string
  publicId: string
  title: string
  coverImage: string | null
  category: OrderCategory
  type: string
  status: string
  amount: number
  quantity: number
  createdAt: string
  isGiveawayPrize: boolean
  requiresCustomerInput: boolean
  /** 0..100 completion of the roadmap. */
  progress: number
  /** ISO deadline for the live mini-timer (only while PROCESSING). */
  dueAt: string | null
  /** Minutes the admin asked to extend, when awaiting the user's yes/no. */
  pendingExtensionMinutes: number | null
  /** Href to the dedicated detail page. */
  href: string
}

export interface OrderEventView {
  type: string
  message: string | null
  actorType: string
  createdAt: string
}

/** Minimal buyer identity shown to admins alongside an order. */
export interface OrderUserRef {
  id: string
  displayName: string | null
  alias: string | null
  email: string | null
}

/**
 * How an order is fulfilled — drives the console badge + which action panel the
 * detail page renders.
 *  - MANUAL  : instant-delivery product; admin submits credentials once.
 *  - ROADMAP : requiresCustomerInput product with the multi-step timer flow.
 *  - DOMAIN  : domain registration/transfer (own lifecycle + NS).
 *  - AUCTION : auction win (delivered like a shop order).
 *  - NONE    : nothing left to do (already delivered/refunded/cancelled).
 */
export type FulfillmentKind = "MANUAL" | "ROADMAP" | "DOMAIN" | "AUCTION" | "NONE"

/** Admin list row: an order needing (or having gone through) fulfilment. */
export interface AdminOrderListItem extends OrderListItem {
  user: OrderUserRef
  /** PROCESSING order whose dueAt has already passed. */
  overdue: boolean
  extensionCount: number
  pendingExtensionMinutes: number | null
  /** Fulfillment discriminator for badge + action routing. */
  fulfillmentKind: FulfillmentKind
}

/** Admin list row for a domain order in the unified console. */
export interface AdminDomainOrderListItem {
  id: string
  publicId: string
  domain: string
  operation: string
  status: string
  amount: number
  progress: number
  createdAt: string
  user: OrderUserRef
  /** True while the buyer has submitted nameservers awaiting admin action. */
  hasNameservers: boolean
  fulfillmentKind: "DOMAIN"
}

/** Full admin detail for a domain order (NS + events + report). */
export interface AdminDomainOrderDetail {
  id: string
  publicId: string
  domain: string
  asciiDomain: string
  tld: string
  operation: string
  status: string
  amount: number
  createdAt: string
  purchasedAt: string | null
  holdExpiresAt: string | null
  expiresAt: string | null
  extensionCount: number
  failureReason: string | null
  user: OrderUserRef
  /** Buyer-submitted nameservers (ns1..ns4; nulls omitted client-side). */
  nameservers: string[]
  nameserversSubmittedAt: string | null
  events: OrderEventView[]
}

/**
 * Buyer-facing detail for a single domain order, shown on the dedicated
 * /orders/domain/[publicId] page inside the unified "My Orders" section.
 * Text-free: the client localizes status/labels; events carry stored messages.
 */
/** A single nameserver change request, shown on the order page + admin console. */
export interface NsRequestView {
  id: string
  publicId: string
  status: string
  nameservers: string[]
  note: string | null
  requestedAt: string
  resolvedAt: string | null
}

export interface UserDomainOrderDetail {
  id: string
  publicId: string
  domain: string
  asciiDomain: string
  tld: string
  operation: string
  status: string
  amount: number
  createdAt: string
  purchasedAt: string | null
  holdExpiresAt: string | null
  expiresAt: string | null
  /** Product-parity roadmap steps for the domain lifecycle. */
  roadmap: RoadmapStep[]
  /** Admin-requested hold extension awaiting the buyer's yes/no (minutes). */
  pendingExtensionMinutes: number | null
  extensionCount: number
  /** True once the domain is registered (COMPLETED) — unlocks NS management. */
  isOwned: boolean
  /** Currently-live nameservers on the owned domain (empty until admin applies). */
  liveNameservers: string[]
  nsUpdatedAt: string | null
  /** Full NS change-request history (newest first). */
  nsRequests: NsRequestView[]
  events: OrderEventView[]
}

/** Admin console row for a nameserver change request. */
export interface AdminNsRequestListItem {
  id: string
  publicId: string
  orderPublicId: string
  domain: string
  status: string
  nameservers: string[]
  note: string | null
  requestedAt: string
  resolvedAt: string | null
  user: OrderUserRef
}

/** Where a purchase originated. Mirror of the Prisma OrderSource enum. */
export type OrderSourceView = "WEB" | "MINI_APP" | "BOT" | "AUCTION"

/**
 * Rich buyer profile shown on the admin order-detail page. Everything an admin
 * needs to identify the account and its Telegram identity at a glance. Fields
 * are nullable because a web-only account may have no Telegram link (and vice
 * versa).
 */
export interface OrderAccountInfo {
  id: string
  displayName: string | null
  alias: string | null
  username: string | null
  email: string | null
  emailVerified: boolean
  role: string
  status: string
  isTestAccount: boolean
  // Telegram identity (numeric id + @username + chat id for support/DM).
  telegramId: string | null
  telegramUsername: string | null
  telegramChatId: string | null
  isPremiumTelegram: boolean
  languageCode: string | null
  // Loyalty / value signals.
  vipTier: string
  vipManual: boolean
  totalSpent: number
  loyaltyPoints: number
  // Account age + who invited them (referral fraud rings).
  createdAt: string
  referredByAlias: string | null
}

/** IP geolocation surfaced for fraud review (all fields best-effort). */
export interface OrderGeoView {
  country: string | null
  countryCode: string | null
  region: string | null
  city: string | null
  isp: string | null
  proxy: boolean
  hosting: boolean
}

/**
 * Technical + security context captured at checkout. Any field may be null on
 * legacy orders or channels that can't supply it (rendered as "unknown").
 */
export interface OrderPurchaseContext {
  source: OrderSourceView | null
  ipAddress: string | null
  userAgent: string | null
  geo: OrderGeoView | null
  /**
   * How many DISTINCT accounts have ever purchased from this same IP (incl.
   * this buyer). > 1 is a multi-account / fraud signal. 0 when no IP stored.
   */
  ipAccountCount: number
}

/**
 * Admin detail: the buyer's submitted account info is ALWAYS revealed here
 * (access-controlled by requireAdmin), unlike the owner-only user detail.
 */
export interface AdminOrderDetail extends OrderDetail {
  user: OrderUserRef
  overdue: boolean
  avgCompletionMinutes: number | null
  /** Fulfillment discriminator (drives the action panel). */
  fulfillmentKind: FulfillmentKind
  /** Accurate payment breakdown (see lib/core/order-report). */
  report: OrderPaymentReport | null
  /** Rich buyer + Telegram profile (fraud review + support). */
  account: OrderAccountInfo | null
  /** Source/IP/UA/geo + IP-sharing signal captured at checkout. */
  purchaseContext: OrderPurchaseContext
}

/** Serializable payment breakdown for a shop/auction order (see order-report). */
export interface OrderPaymentReport {
  net: number
  originalAmount: number
  discountAmount: number
  discountPercent: number
  discountKind: string | null
  couponCode: string | null
  cashback: number
  commission: number
  paymentMethod: "WALLET"
  derived: boolean
}

export interface OrderDetail extends OrderListItem {
  variantName: string | null
  roadmap: RoadmapStep[]
  customerInputTemplate: DeliveryTemplate | null
  customerInputSubmitted: boolean
  /** The buyer's own submitted values (shown back masked). Owner-only. */
  customerInputValues: Record<string, string> | null
  estimatedMinutes: number | null
  processingStartedAt: string | null
  extensionCount: number
  completionNote: string | null
  completionTutorial: { title: string; href: string } | null
  delivery: {
    id: string
    status: string
    payload: Record<string, unknown> | string | null
    template: DeliveryTemplate | null
    has2fa: boolean
    error: string | null
  } | null
  cancelReason: string | null
  cancelReasonCode: string | null
  refundedAmount: number | null
  events: OrderEventView[]
}
