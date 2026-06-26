import { prisma } from "@/lib/db"
import { NotFoundError } from "./errors"
import { summarizeForWatchlist } from "./catalog"

/** Add an auction to the user's watchlist (idempotent). */
export async function addToWatchlist(userId: string, auctionId: string) {
  const auction = await prisma.auction.findUnique({ where: { id: auctionId } })
  if (!auction) throw new NotFoundError("Auction not found")
  await prisma.watchlistEntry.upsert({
    where: { userId_auctionId: { userId, auctionId } },
    create: { userId, auctionId },
    update: {},
  })
  return { watching: true }
}

/** Remove an auction from the user's watchlist (idempotent). */
export async function removeFromWatchlist(userId: string, auctionId: string) {
  await prisma.watchlistEntry.deleteMany({ where: { userId, auctionId } })
  return { watching: false }
}

/** Whether the user is watching a given auction. */
export async function isWatching(userId: string, auctionId: string): Promise<boolean> {
  const entry = await prisma.watchlistEntry.findUnique({
    where: { userId_auctionId: { userId, auctionId } },
  })
  return !!entry
}

/** List the user's watched auctions with summaries. */
export async function listWatchlist(userId: string) {
  const entries = await prisma.watchlistEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      auction: {
        include: { product: true, _count: { select: { bids: true } } },
      },
    },
  })
  return entries.map((e) => summarizeForWatchlist(e.auction))
}

/**
 * Find watchers to notify when an auction goes live. Marks them notified and
 * returns the list so a notification channel (bot, email) can deliver alerts.
 * Designed to be called from the cron tick when an auction transitions to ACTIVE.
 */
export async function collectStartNotifications(auctionId: string) {
  const pending = await prisma.watchlistEntry.findMany({
    where: { auctionId, notified: false },
    include: { user: { select: { id: true, telegramId: true, displayName: true } } },
  })
  if (pending.length === 0) return []
  await prisma.watchlistEntry.updateMany({
    where: { auctionId, notified: false },
    data: { notified: true },
  })
  return pending.map((p) => p.user)
}
