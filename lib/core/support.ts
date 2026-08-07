import { prisma } from "@/lib/db"
import { secureSlug } from "@/lib/id"
import { NotFoundError, ValidationError } from "./errors"
import { audit } from "./audit"
import { enqueueTranslations } from "@/lib/i18n/content-translation"
import { sanitizeRichHtml } from "@/lib/rich-content/sanitize"

export const SUPPORT_CATEGORIES = ["GENERAL", "PAYMENT", "ORDER", "REFUND", "TECHNICAL"] as const
export type SupportCategoryValue = (typeof SUPPORT_CATEGORIES)[number]

export const SUPPORT_STATUSES = ["OPEN", "IN_PROGRESS", "ANSWERED", "PENDING", "CLOSED"] as const
export type SupportStatusValue = (typeof SUPPORT_STATUSES)[number]

export const REACTION_TYPES = ["THANKS", "HEART", "LIKE", "DISLIKE"] as const
export type ReactionTypeValue = (typeof REACTION_TYPES)[number]

/**
 * A sanitized, server-trusted attachment descriptor. These are produced ONLY by
 * the upload route after magic-byte verification and (for images) sharp
 * re-encoding — never assembled from client-declared values — so persisting
 * them here is safe.
 */
export interface AttachmentInput {
  url: string
  kind: "IMAGE" | "PDF" | "TEXT"
  name: string
  mimeType: string
  size: number
  width?: number
  height?: number
}

/** Shared thread projection: every message carries its attachments + reactions. */
const messageInclude = {
  orderBy: { createdAt: "asc" as const },
  include: {
    attachments: { orderBy: { createdAt: "asc" as const } },
    reactions: { select: { id: true, type: true, userId: true } },
  },
}

/** Cap the number of attachments accepted on a single message. */
const MAX_ATTACHMENTS = 5

/** Build the Prisma nested-create payload for a message's attachments. */
function attachmentCreate(attachments?: AttachmentInput[]) {
  const list = (attachments ?? []).slice(0, MAX_ATTACHMENTS)
  if (list.length === 0) return undefined
  return {
    create: list.map((a) => ({
      kind: a.kind,
      url: a.url,
      name: a.name.slice(0, 200),
      mimeType: a.mimeType,
      size: a.size,
      width: a.width ?? null,
      height: a.height ?? null,
    })),
  }
}

/**
 * Canonical subject used for a banned user's "contact support / appeal" thread.
 * A banned user is locked out of the whole bot, so this dedicated thread is the
 * only channel they can reach an admin through. We reuse one open thread per
 * user (instead of spawning a ticket per message) so the conversation stays a
 * single two-way channel.
 */
export const BAN_APPEAL_SUBJECT = "درخواست بررسی مسدودیت حساب"

/** The still-open ban-appeal thread for a user, or null. Not owner-throwing. */
export async function getOpenBanAppeal(userId: string) {
  return prisma.supportTicket.findFirst({
    where: { userId, subject: BAN_APPEAL_SUBJECT, status: { not: "CLOSED" } },
    orderBy: { lastReplyAt: "desc" },
  })
}

function normalizeCategory(value?: string): SupportCategoryValue {
  return (SUPPORT_CATEGORIES as readonly string[]).includes(value ?? "")
    ? (value as SupportCategoryValue)
    : "GENERAL"
}

export interface CreateTicketInput {
  userId: string
  subject: string
  category?: string
  message: string
  attachments?: AttachmentInput[]
}

/** User opens a new support ticket with an initial message. */
export async function createTicket(input: CreateTicketInput) {
  const subject = input.subject.trim()
  const message = input.message.trim()
  const hasAttachments = (input.attachments?.length ?? 0) > 0
  if (subject.length < 3) throw new ValidationError("موضوع تیکت باید حداقل ۳ نویسه باشد")
  // Allow a short/empty body when the user is sending attachments only.
  if (message.length < 5 && !hasAttachments) throw new ValidationError("متن پیام بسیار کوتاه است")

  const ticket = await prisma.supportTicket.create({
    data: {
      publicId: secureSlug("tk"),
      userId: input.userId,
      subject,
      category: normalizeCategory(input.category),
      status: "OPEN",
      lastReplyAt: new Date(),
      messages: {
        create: {
          authorId: input.userId,
          fromStaff: false,
          body: message,
          attachments: attachmentCreate(input.attachments),
        },
      },
    },
    include: { messages: messageInclude },
  })
  await audit({ actorId: input.userId, action: "ticket.create", entity: "ticket", entityId: ticket.id })
  await Promise.all([
    enqueueTranslations({ entityType: "support-ticket", entityId: ticket.id, sourceData: { subject } }),
    enqueueTranslations({ entityType: "ticket-message", entityId: ticket.messages[0].id, sourceData: { body: message } }),
  ])
  return ticket
}

/** All of a user's tickets, newest activity first. */
export async function listTickets(userId: string) {
  return prisma.supportTicket.findMany({
    where: { userId },
    orderBy: { lastReplyAt: "desc" },
    take: 100,
    include: { _count: { select: { messages: true } } },
  })
}

/** A single ticket with its full thread — scoped to the owner. */
export async function getTicket(userId: string, publicId: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { publicId },
    include: { messages: messageInclude },
  })
  if (!ticket || ticket.userId !== userId) throw new NotFoundError("تیکت یافت نشد")
  return ticket
}

export interface ReplyInput {
  userId: string
  publicId: string
  message: string
  attachments?: AttachmentInput[]
}

/** User posts a reply to one of their tickets. */
export async function replyToTicket(input: ReplyInput) {
  const ticket = await prisma.supportTicket.findUnique({ where: { publicId: input.publicId } })
  if (!ticket || ticket.userId !== input.userId) throw new NotFoundError("تیکت یافت نشد")
  if (ticket.status === "CLOSED") throw new ValidationError("این تیکت بسته شده است و امکان ارسال پیام نیست")

  const body = input.message.trim()
  const hasAttachments = (input.attachments?.length ?? 0) > 0
  if (body.length < 1 && !hasAttachments) throw new ValidationError("متن پیام خالی است")

  const message = await prisma.ticketMessage.create({
    data: {
      ticketId: ticket.id,
      authorId: input.userId,
      fromStaff: false,
      body,
      attachments: attachmentCreate(input.attachments),
    },
    include: { attachments: { orderBy: { createdAt: "asc" } }, reactions: { select: { id: true, type: true, userId: true } } },
  })
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: "PENDING", lastReplyAt: new Date() },
  })
  if (body) await enqueueTranslations({ entityType: "ticket-message", entityId: message.id, sourceData: { body } })
  return message
}

/** User closes their own ticket. */
export async function closeTicket(userId: string, publicId: string) {
  const ticket = await prisma.supportTicket.findUnique({ where: { publicId } })
  if (!ticket || ticket.userId !== userId) throw new NotFoundError("تیکت یافت نشد")
  return prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: "CLOSED" } })
}

// --- Staff (admin) actions ---------------------------------------------------

export interface AdminTicketFilter {
  status?: string
  category?: string
  /** Free-text search across subject and message bodies. */
  q?: string
}

/** All tickets across users, filtered by status/category and a text query. */
export async function listTicketsAdmin(filter?: AdminTicketFilter | string) {
  // Back-compat: a bare string is treated as a status filter.
  const f: AdminTicketFilter = typeof filter === "string" ? { status: filter } : (filter ?? {})
  const status = f.status && (SUPPORT_STATUSES as readonly string[]).includes(f.status) ? f.status : undefined
  const category = f.category && (SUPPORT_CATEGORIES as readonly string[]).includes(f.category) ? f.category : undefined
  const q = f.q?.trim()

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (category) where.category = category
  if (q) {
    where.OR = [
      { subject: { contains: q, mode: "insensitive" } },
      { publicId: { contains: q, mode: "insensitive" } },
      { messages: { some: { body: { contains: q, mode: "insensitive" } } } },
      { user: { is: { displayName: { contains: q, mode: "insensitive" } } } },
    ]
  }

  const tickets = await prisma.supportTicket.findMany({
    where,
    orderBy: { lastReplyAt: "desc" },
    take: 200,
    include: {
      _count: { select: { messages: true } },
      user: { select: { displayName: true, alias: true } },
    },
  })
  return tickets.map(({ _count, ...t }) => ({ ...t, messageCount: _count.messages }))
}

/** Staff fetches any ticket thread. */
export async function getTicketAdmin(publicId: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { publicId },
    include: {
      messages: messageInclude,
      user: { select: { displayName: true, alias: true } },
    },
  })
  if (!ticket) throw new NotFoundError("تیکت یافت نشد")
  return ticket
}

/** Staff replies to a ticket, marking it answered (or closed). */
export async function staffReply(input: {
  staffId: string
  publicId: string
  message: string
  /** Optional rich HTML from the admin editor; sanitized here before storage. */
  html?: string
  attachments?: AttachmentInput[]
  close?: boolean
}) {
  const ticket = await prisma.supportTicket.findUnique({ where: { publicId: input.publicId } })
  if (!ticket) throw new NotFoundError("تیکت یافت نشد")
  const body = input.message.trim()
  const hasAttachments = (input.attachments?.length ?? 0) > 0
  if (body.length < 1 && !hasAttachments) throw new ValidationError("متن پیام خالی است")

  // Sanitize any rich HTML defensively at the trust boundary. Store null when
  // it carries no formatting beyond the plain text (keeps rendering simple).
  const cleanHtml = input.html ? sanitizeRichHtml(input.html) : null
  const bodyHtml = cleanHtml && cleanHtml.replace(/<[^>]*>/g, "").trim() ? cleanHtml : null

  const message = await prisma.ticketMessage.create({
    data: {
      ticketId: ticket.id,
      authorId: input.staffId,
      fromStaff: true,
      body,
      bodyHtml,
      attachments: attachmentCreate(input.attachments),
    },
    include: { attachments: { orderBy: { createdAt: "asc" } }, reactions: { select: { id: true, type: true, userId: true } } },
  })
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: input.close ? "CLOSED" : "ANSWERED", lastReplyAt: new Date() },
  })
  await audit({ actorId: input.staffId, action: "ticket.reply", entity: "ticket", entityId: ticket.id })
  if (body) await enqueueTranslations({ entityType: "ticket-message", entityId: message.id, sourceData: { body } })
  // Email the ticket owner that support replied (best-effort).
  const { sendSupportReplyEmail } = await import("@/lib/email")
  await sendSupportReplyEmail({
    userId: ticket.userId,
    ticketId: ticket.publicId,
    subject: ticket.subject,
    message: body || "پیام جدید پشتیبانی (پیوست)",
  })
  // Push the reply into the owner's Telegram chat so the conversation is truly
  // two-way in the bot (critical for banned users, who can't use the dashboard).
  const { notifySupportReply } = await import("@/lib/telegram/notify")
  await notifySupportReply(ticket.userId, {
    subject: ticket.subject,
    body: body || "پیام جدید پشتیبانی (پیوست)",
    isBanAppeal: ticket.subject === BAN_APPEAL_SUBJECT,
    closed: Boolean(input.close),
  })
  return message
}

// --- Reactions ---------------------------------------------------------------

/**
 * Toggle an emoji reaction on a message. Either party (ticket owner or admin)
 * may react on any message in a thread they can access. One reaction per user
 * per message: reacting with the same type removes it, a different type
 * replaces it. Returns the message's full reaction list after the change.
 */
export async function setReaction(input: {
  userId: string
  isAdmin: boolean
  messageId: string
  type: ReactionTypeValue
}) {
  if (!(REACTION_TYPES as readonly string[]).includes(input.type)) {
    throw new ValidationError("نوع واکنش نامعتبر است")
  }
  const message = await prisma.ticketMessage.findUnique({
    where: { id: input.messageId },
    select: { id: true, ticket: { select: { userId: true } } },
  })
  if (!message) throw new NotFoundError("پیام یافت نشد")
  // Authorization: admins can react anywhere; users only within their own thread.
  if (!input.isAdmin && message.ticket.userId !== input.userId) {
    throw new NotFoundError("پیام یافت نشد")
  }

  const existing = await prisma.supportReaction.findUnique({
    where: { messageId_userId: { messageId: input.messageId, userId: input.userId } },
  })
  if (existing && existing.type === input.type) {
    await prisma.supportReaction.delete({ where: { id: existing.id } })
  } else if (existing) {
    await prisma.supportReaction.update({ where: { id: existing.id }, data: { type: input.type } })
  } else {
    await prisma.supportReaction.create({
      data: { messageId: input.messageId, userId: input.userId, type: input.type },
    })
  }
  return prisma.supportReaction.findMany({
    where: { messageId: input.messageId },
    select: { id: true, type: true, userId: true },
  })
}

// --- Read receipts -----------------------------------------------------------

/**
 * Mark every staff message in a thread as read by the owner. Called
 * automatically when the user opens/polls their ticket, giving admins a
 * two-tick "seen" signal. Scoped to the thread owner.
 */
export async function markThreadReadByUser(userId: string, publicId: string) {
  const ticket = await prisma.supportTicket.findUnique({ where: { publicId }, select: { id: true, userId: true } })
  if (!ticket || ticket.userId !== userId) throw new NotFoundError("تیکت یافت نشد")
  const res = await prisma.ticketMessage.updateMany({
    where: { ticketId: ticket.id, fromStaff: true, readAt: null },
    data: { readAt: new Date() },
  })
  return { updated: res.count }
}

/**
 * Admin manually marks a single user message as read (a deliberate two-tick
 * receipt — the reference explicitly does NOT want this to be automatic for
 * staff, so the admin controls when the user sees it was read).
 */
export async function markMessageReadByStaff(messageId: string) {
  const message = await prisma.ticketMessage.findUnique({ where: { id: messageId }, select: { id: true, fromStaff: true } })
  if (!message) throw new NotFoundError("پیام یافت نشد")
  // Only user-authored messages carry a staff-set read receipt.
  if (message.fromStaff) throw new ValidationError("فقط پیام کاربر قابل علامت‌گذاری است")
  return prisma.ticketMessage.update({ where: { id: messageId }, data: { readAt: new Date() } })
}

// --- Admin status / category -------------------------------------------------

/** Admin sets a ticket's workflow status (e.g. mark it IN_PROGRESS). */
export async function setTicketStatus(input: { staffId: string; publicId: string; status: SupportStatusValue }) {
  if (!(SUPPORT_STATUSES as readonly string[]).includes(input.status)) {
    throw new ValidationError("وضعیت نامعتبر است")
  }
  const ticket = await prisma.supportTicket.findUnique({ where: { publicId: input.publicId }, select: { id: true } })
  if (!ticket) throw new NotFoundError("تیکت یافت نشد")
  const updated = await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: input.status } })
  await audit({ actorId: input.staffId, action: "ticket.status", entity: "ticket", entityId: ticket.id, meta: { status: input.status } })
  return updated
}

/** Admin re-categorizes a ticket. */
export async function setTicketCategory(input: { staffId: string; publicId: string; category: SupportCategoryValue }) {
  const ticket = await prisma.supportTicket.findUnique({ where: { publicId: input.publicId }, select: { id: true } })
  if (!ticket) throw new NotFoundError("تیکت یافت نشد")
  const updated = await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { category: normalizeCategory(input.category) },
  })
  await audit({ actorId: input.staffId, action: "ticket.category", entity: "ticket", entityId: ticket.id, meta: { category: input.category } })
  return updated
}
