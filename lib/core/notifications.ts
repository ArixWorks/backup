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

/** List a user's notifications (newest first), with an unread count. */
export async function listNotifications(userId: string, opts?: { limit?: number; unreadOnly?: boolean }) {
  const limit = Math.min(opts?.limit ?? 30, 100)
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId, ...(opts?.unreadOnly ? { read: false } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({ where: { userId, read: false } }),
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
