/**
 * AuctionWinnerEngine — the single source of truth for "who won and for how
 * much" (fixes Problems 2 & 3: winner must come from a dedicated result, not
 * be inferred from the last normal bid).
 *
 * Settlement writes `winnerUserId`, `finalPrice` and `endReason` onto the
 * Auction. This module resolves those fields, with a safe fallback for LEGACY
 * rows finalized before the winner fields existed (derive from the top bid).
 */

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import type { AuctionWinnerResult, AuctionEndReason } from "./types"

type Db = Prisma.TransactionClient | typeof prisma

export interface WinnerAuctionRow {
  id: string
  status: string
  startPrice: bigint
  currentPrice: bigint
  reservePrice: bigint | null
  winnerUserId: string | null
  finalPrice: bigint | null
  endReason: AuctionEndReason | null
}

/**
 * Compute the winner + final price + reason from the ranked standings at
 * settlement time. Single-winner semantics for the public winner spotlight
 * (multi-winner settlement still credits every eligible bidder separately).
 */
export function computeWinnerFromStandings(
  opts: {
    topBidderId: string | null
    topAmount: bigint | null
    reservePrice: bigint | null
    boughtNow?: { userId: string; price: bigint } | null
  },
): { winnerUserId: string | null; finalPrice: bigint | null; endReason: AuctionEndReason } {
  // Buy Now always wins outright at the paid price.
  if (opts.boughtNow) {
    return { winnerUserId: opts.boughtNow.userId, finalPrice: opts.boughtNow.price, endReason: "BUY_NOW" }
  }
  if (!opts.topBidderId || opts.topAmount === null) {
    return { winnerUserId: null, finalPrice: null, endReason: "HIGHEST_BID" }
  }
  // Reserve not met → no sale.
  if (opts.reservePrice !== null && opts.topAmount < opts.reservePrice) {
    return { winnerUserId: null, finalPrice: null, endReason: "RESERVE_NOT_MET" }
  }
  return { winnerUserId: opts.topBidderId, finalPrice: opts.topAmount, endReason: "HIGHEST_BID" }
}

/**
 * Resolve the winner for an auction row. Uses the stored winner fields when
 * present; otherwise, for an already-ended/finalized row, falls back to the
 * top bid (legacy compatibility). Returns `hasWinner:false` for live auctions.
 */
export async function resolveWinner(auction: WinnerAuctionRow, db: Db = prisma): Promise<AuctionWinnerResult> {
  // Stored result (authoritative for anything settled by the new engine).
  if (auction.winnerUserId || auction.endReason === "RESERVE_NOT_MET") {
    return {
      hasWinner: !!auction.winnerUserId,
      winnerUserId: auction.winnerUserId,
      finalPrice: auction.finalPrice,
      endReason: auction.endReason ?? "HIGHEST_BID",
      legacy: false,
    }
  }

  const ended = ["ENDED", "FINALIZED", "SOLD", "SETTLED", "PAID"].includes(auction.status)
  if (!ended) {
    return { hasWinner: false, winnerUserId: null, finalPrice: null, endReason: null, legacy: false }
  }

  // Legacy fallback: derive the winner from the highest bid on a finalized row.
  const grouped = await db.bid.groupBy({
    by: ["userId"],
    where: { auctionId: auction.id },
    _max: { amount: true },
  })
  let topBidderId: string | null = null
  let topAmount: bigint | null = null
  for (const g of grouped) {
    const amt = g._max.amount ?? 0n
    if (topAmount === null || amt > topAmount) {
      topAmount = amt
      topBidderId = g.userId
    }
  }
  const derived = computeWinnerFromStandings({
    topBidderId,
    topAmount,
    reservePrice: auction.reservePrice,
    boughtNow: null,
  })
  return {
    hasWinner: !!derived.winnerUserId,
    winnerUserId: derived.winnerUserId,
    finalPrice: derived.finalPrice ?? (topAmount ?? auction.currentPrice),
    endReason: derived.endReason,
    legacy: true,
  }
}
