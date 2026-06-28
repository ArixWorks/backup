import { prisma } from "@/lib/db"
import { secureSlug } from "@/lib/id"
import { NotFoundError, ValidationError } from "./errors"
import { audit } from "./audit"

export const SUPPORT_CATEGORIES = ["GENERAL", "PAYMENT", "ORDER", "REFUND", "TECHNICAL"] as const
export type SupportCategoryValue = (typeof SUPPORT_CATEGORIES)[number]

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
  attachmentUrl?: string
}

/** User opens a new support ticket with an initial message. */
export async function createTicket(input: CreateTicketInput) {
  const subject = input.subject.trim()
  const message = input.message.trim()
  if (subject.length < 3) throw new ValidationError("موضوع تیکت باید حداقل ۳ نویسه باشد")
  if (message.length < 5) throw new ValidationError("متن پیام بسیار کوتاه است")

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
          attachmentUrl: input.attachmentUrl,
        },
      },
    },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  })
  await audit({ actorId: input.userId, action: "ticket.create", entity: "ticket", entityId: ticket.id })
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
    include: { messages: { orderBy: { createdAt: "asc" } } },
  })
  if (!ticket || ticket.userId !== userId) throw new NotFoundError("تیکت یافت نشد")
  return ticket
}

export interface ReplyInput {
  userId: string
  publicId: string
  message: string
  attachmentUrl?: string
}

/** User posts a reply to one of their tickets. */
export async function replyToTicket(input: ReplyInput) {
  const ticket = await prisma.supportTicket.findUnique({ where: { publicId: input.publicId } })
  if (!ticket || ticket.userId !== input.userId) throw new NotFoundError("تیکت یافت نشد")
  if (ticket.status === "CLOSED") throw new ValidationError("این تیکت بسته شده است و امکان ارسال پیام نیست")

  const body = input.message.trim()
  if (body.length < 1) throw new ValidationError("متن پیام خالی است")

  const message = await prisma.ticketMessage.create({
    data: {
      ticketId: ticket.id,
      authorId: input.userId,
      fromStaff: false,
      body,
      attachmentUrl: input.attachmentUrl,
    },
  })
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: "PENDING", lastReplyAt: new Date() },
  })
  return message
}

/** User closes their own ticket. */
export async function closeTicket(userId: string, publicId: string) {
  const ticket = await prisma.supportTicket.findUnique({ where: { publicId } })
  if (!ticket || ticket.userId !== userId) throw new NotFoundError("تیکت یافت نشد")
  return prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: "CLOSED" } })
}

// --- Staff (admin) actions ---------------------------------------------------

/** All tickets across users, optionally filtered by status. */
export async function listTicketsAdmin(status?: string) {
  const tickets = await prisma.supportTicket.findMany({
    where: status ? { status: status as never } : undefined,
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
      messages: { orderBy: { createdAt: "asc" } },
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
  attachmentUrl?: string
  close?: boolean
}) {
  const ticket = await prisma.supportTicket.findUnique({ where: { publicId: input.publicId } })
  if (!ticket) throw new NotFoundError("تیکت یافت نشد")
  const body = input.message.trim()
  if (body.length < 1) throw new ValidationError("متن پیام خالی است")

  const message = await prisma.ticketMessage.create({
    data: {
      ticketId: ticket.id,
      authorId: input.staffId,
      fromStaff: true,
      body,
      attachmentUrl: input.attachmentUrl,
    },
  })
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { status: input.close ? "CLOSED" : "ANSWERED", lastReplyAt: new Date() },
  })
  await audit({ actorId: input.staffId, action: "ticket.reply", entity: "ticket", entityId: ticket.id })
  // Email the ticket owner that support replied (best-effort).
  const { sendSupportReplyEmail } = await import("@/lib/email")
  await sendSupportReplyEmail({
    userId: ticket.userId,
    ticketId: ticket.publicId,
    subject: ticket.subject,
    message: body,
  })
  return message
}
