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

/** Stable, localizable roadmap step identifiers. */
export type StepKey = "payment" | "input" | "processing" | "complete"

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

  const steps: RoadmapStep[] = [
    { key: "payment", state: "done" },
    {
      key: "input",
      state: inputDone ? "done" : status === "AWAITING_CUSTOMER_INPUT" ? "active" : "upcoming",
    },
    {
      key: "processing",
      state: complete ? "done" : processingActive ? "active" : cancelled && inputDone ? "cancelled" : "upcoming",
    },
    {
      key: "complete",
      state: complete ? "done" : cancelled ? "cancelled" : "upcoming",
    },
  ]

  const doneCount = steps.filter((s) => s.state === "done").length
  const progress = Math.round((doneCount / steps.length) * 100)
  return { roadmap: steps, progress }
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
