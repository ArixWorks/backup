/**
 * AuctionEventService — the append-only auction activity timeline (Phase 16).
 * Powers the transparent public timeline and admin analytics. Writes are
 * best-effort: recording a timeline entry must NEVER break a bid/settlement.
 */

import type { Prisma, AuctionEventType } from "@prisma/client"
import { prisma } from "@/lib/db"

type Db = Prisma.TransactionClient | typeof prisma

export interface AuctionEventInput {
  auctionId: string
  type: AuctionEventType
  userId?: string | null
  amount?: bigint | null
  /** Optional structured context, JSON-serialized into `meta`. */
  meta?: Record<string, unknown> | null
}

/**
 * Record a timeline event. When a transaction client is supplied the write
 * participates in that transaction (so events commit atomically with the state
 * change). Outside a tx it is fully best-effort and swallows errors.
 */
export async function recordAuctionEvent(input: AuctionEventInput, tx?: Db): Promise<void> {
  const data = {
    auctionId: input.auctionId,
    type: input.type,
    userId: input.userId ?? null,
    amount: input.amount ?? null,
    meta: input.meta ? JSON.stringify(input.meta) : null,
  }
  if (tx) {
    // In-transaction: let failures propagate so the tx stays consistent.
    await tx.auctionEvent.create({ data })
    return
  }
  try {
    await prisma.auctionEvent.create({ data })
  } catch {
    /* timeline is non-critical — never throw */
  }
}

export interface AuctionTimelineEntry {
  id: string
  type: AuctionEventType
  userId: string | null
  amount: bigint | null
  meta: Record<string, unknown> | null
  createdAt: Date
}

/** Read an auction's timeline, newest first. */
export async function getAuctionTimeline(
  auctionId: string,
  opts: { limit?: number } = {},
): Promise<AuctionTimelineEntry[]> {
  const rows = await prisma.auctionEvent.findMany({
    where: { auctionId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(opts.limit ?? 50, 1), 200),
  })
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    userId: r.userId,
    amount: r.amount,
    meta: parseMeta(r.meta),
    createdAt: r.createdAt,
  }))
}

function parseMeta(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw)
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}
