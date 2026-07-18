import { prisma } from "@/lib/db"
import type { NotificationType, Prisma } from "@prisma/client"

type Db = Prisma.TransactionClient | typeof prisma

export interface CreateNotificationInput {
  userId: string
  type?: NotificationType
  title: string
  body: string
  href?: string | null
  image?: string | null
}

/** Persist a single in-app notification. */
export async function createNotification(input: CreateNotificationInput, db: Db = prisma) {
  return db.notification.create({
    data: {
      userId: input.userId,
      type: input.type ?? "GENERAL",
      title: input.title,
      body: input.body,
      href: input.href ?? null,
      image: input.image ?? null,
    },
  })
}

/** Persist many notifications at once (e.g. fan-out to watchers). */
export async function createNotifications(inputs: CreateNotificationInput[], db: Db = prisma) {
  if (inputs.length === 0) return { count: 0 }
  return db.notification.createMany({
    data: inputs.map((i) => ({
      userId: i.userId,
      type: i.type ?? "GENERAL",
      title: i.title,
      body: i.body,
      href: i.href ?? null,
      image: i.image ?? null,
    })),
  })
}

export interface ListNotificationsOpts {
  limit?: number
  unreadOnly?: boolean
  /** Filter by a specific notification type. */
  type?: NotificationType
  /** Full-text search across title and body. */
  search?: string
  /** Include archived notifications (default: only non-archived). */
  archived?: boolean
}

/** List a user's notifications (newest first), with an unread count. */
export async function listNotifications(userId: string, opts?: ListNotificationsOpts) {
  const requestedLimit = opts?.limit ?? 30
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 100)
    : 30
  const where: Prisma.NotificationWhereInput = {
    userId,
    archived: opts?.archived ?? false,
    ...(opts?.unreadOnly ? { read: false } : {}),
    ...(opts?.type ? { type: opts.type } : {}),
    ...(opts?.search
      ? {
          OR: [
            { title: { contains: opts.search, mode: "insensitive" } },
            { body: { contains: opts.search, mode: "insensitive" } },
          ],
        }
      : {}),
  }
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: limit }),
    // Unread count is always over the live (non-archived) inbox, ignoring filters.
    prisma.notification.count({ where: { userId, read: false, archived: false } }),
  ])
  return { items, unread }
}

/** Unread badge count only (cheap polling endpoint). */
export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, read: false } })
}

/** Mark a single notification read (scoped to the owner). */
export async function markRead(userId: string, id: string) {
  await prisma.notification.updateMany({ where: { id, userId }, data: { read: true } })
  return { ok: true }
}

/** Mark all of a user's notifications read. */
export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } })
  return { ok: true }
}

/** Archive a single notification (hide from inbox, keep the record). */
export async function archiveNotification(userId: string, id: string) {
  await prisma.notification.updateMany({ where: { id, userId }, data: { archived: true, read: true } })
  return { ok: true }
}

/** Restore an archived notification back into the inbox. */
export async function unarchiveNotification(userId: string, id: string) {
  await prisma.notification.updateMany({ where: { id, userId }, data: { archived: false } })
  return { ok: true }
}

/** Permanently delete a single notification (scoped to the owner). */
export async function deleteNotification(userId: string, id: string) {
  await prisma.notification.deleteMany({ where: { id, userId } })
  return { ok: true }
}

/** Clear (delete) all of a user's archived notifications. */
export async function clearArchived(userId: string) {
  const { count } = await prisma.notification.deleteMany({ where: { userId, archived: true } })
  return { ok: true, count }
}
