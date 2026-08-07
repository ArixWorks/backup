import type { ReactionType } from "./message-reactions"
import type { TicketAttachment } from "./attachment-preview"

/** A single message in a ticket thread, as returned by the API. */
export interface TicketMessageDTO {
  id: string
  authorId: string | null
  fromStaff: boolean
  isSystem: boolean
  body: string
  bodyHtml: string | null
  readAt: string | null
  createdAt: string
  attachments: TicketAttachment[]
  reactions: { id: string; type: ReactionType; userId: string }[]
}

/** Workflow status of a ticket. */
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "ANSWERED" | "PENDING" | "CLOSED"

/** Category of a ticket. */
export type TicketCategory = "GENERAL" | "PAYMENT" | "ORDER" | "REFUND" | "TECHNICAL"

export interface TicketDTO {
  id: string
  publicId: string
  subject: string
  category: TicketCategory
  status: TicketStatus
  createdAt: string
  lastReplyAt: string | null
  messages: TicketMessageDTO[]
}

/** Visual metadata for each status: label + themed color token classes. */
export const STATUS_META: Record<TicketStatus, { label: string; className: string }> = {
  OPEN: { label: "باز", className: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  IN_PROGRESS: { label: "در حال بررسی", className: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  ANSWERED: { label: "پاسخ داده شد", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  PENDING: { label: "در انتظار پشتیبانی", className: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  CLOSED: { label: "بسته شده", className: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30" },
}

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  GENERAL: "عمومی",
  PAYMENT: "پرداخت",
  ORDER: "سفارش",
  REFUND: "بازگشت وجه",
  TECHNICAL: "فنی",
}
