/**
 * PR3 — Auction Lifecycle QA acceptance harness (temporary; deleted after run).
 *
 * Exercises the PURE engine surface that PR3 wires into the runtime service:
 * tiered increments, next-minimum-bid, soft-close (window + cap), reserve /
 * winner resolution, and terminal-status classification. No DB or network — the
 * engine functions are deterministic, so this is a fast, production-safe matrix.
 */

import {
  DEFAULT_AUCTION_POLICY,
  normalizeAuctionPolicy,
} from "../lib/core/auction/policy"
import {
  incrementForPrice,
  nextMinimumBid,
} from "../lib/core/auction/pricing"
import {
  computeSoftCloseExtension,
  isTerminalStatus,
  isBiddable,
} from "../lib/core/auction/lifecycle"
import { computeWinnerFromStandings } from "../lib/core/auction/winner"
import type { AuctionPolicy } from "../lib/core/auction/types"

let passed = 0
let failed = 0
const failures: string[] = []

function check(name: string, cond: boolean) {
  if (cond) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    failures.push(name)
    console.log(`  FAIL  ${name}`)
  }
}

const P: AuctionPolicy = DEFAULT_AUCTION_POLICY

console.log("\n=== 1. Tiered bid increments ===")
// Default tiers: <500k→10k, <2m→50k, <10m→250k, open→500k.
check("increment @ 100k = 10k", incrementForPrice(100_000n, P) === 10_000n)
check("increment @ 499,999 = 10k", incrementForPrice(499_999n, P) === 10_000n)
check("increment @ 500k = 50k (tier boundary exclusive)", incrementForPrice(500_000n, P) === 50_000n)
check("increment @ 1.5m = 50k", incrementForPrice(1_500_000n, P) === 50_000n)
check("increment @ 5m = 250k", incrementForPrice(5_000_000n, P) === 250_000n)
check("increment @ 50m = 500k (open-ended top tier)", incrementForPrice(50_000_000n, P) === 500_000n)

console.log("\n=== 2. Next minimum bid ===")
check(
  "no bids → startPrice",
  nextMinimumBid({ startPrice: 300_000n, currentPrice: 0n, hasBids: false }, P) === 300_000n,
)
check(
  "with bids @ 100k → 110k (current + 10k tier)",
  nextMinimumBid({ startPrice: 100_000n, currentPrice: 100_000n, hasBids: true }, P) === 110_000n,
)
check(
  "with bids @ 1.5m → 1.55m (current + 50k tier)",
  nextMinimumBid({ startPrice: 100_000n, currentPrice: 1_500_000n, hasBids: true }, P) === 1_550_000n,
)

console.log("\n=== 3. FIXED increment strategy ===")
const fixed = normalizeAuctionPolicy({
  ...P,
  bidIncrementStrategy: "FIXED",
  minimumIncrementRules: [{ upTo: null, increment: 25_000 }],
})
check("FIXED @ 100k = 25k", incrementForPrice(100_000n, fixed) === 25_000n)
check("FIXED @ 9m = 25k (price-independent)", incrementForPrice(9_000_000n, fixed) === 25_000n)

console.log("\n=== 4. Soft-close / anti-sniping ===")
const now = new Date("2026-01-01T00:00:00Z")
// Bid outside the window (5 min left, window 120s) → no extension.
check(
  "outside window → no extension",
  computeSoftCloseExtension(
    { endTime: new Date(now.getTime() + 300_000), softCloseExtensions: 0 },
    P,
    now,
  ) === null,
)
// Bid inside window (60s left) → extend by 120s.
const ext = computeSoftCloseExtension(
  { endTime: new Date(now.getTime() + 60_000), softCloseExtensions: 0 },
  P,
  now,
)
check("inside window → extends", ext !== null)
check(
  "extension adds softCloseExtensionSeconds",
  ext !== null && ext.getTime() === now.getTime() + 60_000 + P.softCloseExtensionSeconds * 1000,
)
// Cap reached → no further extension.
check(
  "extension cap enforced (no infinite sniping)",
  computeSoftCloseExtension(
    { endTime: new Date(now.getTime() + 60_000), softCloseExtensions: P.maxSoftCloseExtensions },
    P,
    now,
  ) === null,
)
// Already ended → no extension.
check(
  "already past end → no extension",
  computeSoftCloseExtension(
    { endTime: new Date(now.getTime() - 1_000), softCloseExtensions: 0 },
    P,
    now,
  ) === null,
)
// Disabled by policy → no extension.
const noSoft = normalizeAuctionPolicy({ ...P, softCloseEnabled: false })
check(
  "softCloseEnabled=false → no extension",
  computeSoftCloseExtension(
    { endTime: new Date(now.getTime() + 60_000), softCloseExtensions: 0 },
    noSoft,
    now,
  ) === null,
)

console.log("\n=== 5. Reserve + winner resolution ===")
check(
  "reserve met → HIGHEST_BID winner",
  (() => {
    const r = computeWinnerFromStandings({
      topBidderId: "u1",
      topAmount: 1_000_000n,
      reservePrice: 800_000n,
    })
    return r.endReason === "HIGHEST_BID" && r.winnerUserId === "u1" && r.finalPrice === 1_000_000n
  })(),
)
check(
  "reserve NOT met → no winner, RESERVE_NOT_MET",
  (() => {
    const r = computeWinnerFromStandings({
      topBidderId: "u1",
      topAmount: 500_000n,
      reservePrice: 800_000n,
    })
    return r.endReason === "RESERVE_NOT_MET" && r.winnerUserId === null && r.finalPrice === null
  })(),
)
check(
  "no bids → no winner",
  (() => {
    const r = computeWinnerFromStandings({ topBidderId: null, topAmount: null, reservePrice: null })
    return r.winnerUserId === null
  })(),
)
check(
  "buy-now → BUY_NOW winner at paid price",
  (() => {
    const r = computeWinnerFromStandings({
      topBidderId: "u1",
      topAmount: 900_000n,
      reservePrice: null,
      boughtNow: { userId: "u2", price: 1_200_000n },
    })
    return r.endReason === "BUY_NOW" && r.winnerUserId === "u2" && r.finalPrice === 1_200_000n
  })(),
)

console.log("\n=== 6. Terminal-status classification ===")
for (const s of ["FINALIZED", "SOLD", "SETTLED", "RESERVE_NOT_MET", "CANCELLED", "DEFAULTED", "PAID"]) {
  check(`${s} is terminal`, isTerminalStatus(s) === true)
}
for (const s of ["SCHEDULED", "ACTIVE", "ENDED"]) {
  check(`${s} is NOT terminal`, isTerminalStatus(s) === false)
}
// A SOLD (Buy-Now) auction before end time must NOT be biddable.
check(
  "SOLD auction not biddable before end",
  isBiddable(
    { status: "SOLD", startTime: new Date(now.getTime() - 1000), endTime: new Date(now.getTime() + 60_000) },
    now,
  ) === false,
)
check(
  "ACTIVE auction in-window is biddable",
  isBiddable(
    { status: "ACTIVE", startTime: new Date(now.getTime() - 1000), endTime: new Date(now.getTime() + 60_000) },
    now,
  ) === true,
)

console.log(`\n=== PR3 Auction Lifecycle QA: ${passed}/${passed + failed} passed ===`)
if (failed > 0) {
  console.log("FAILURES:\n - " + failures.join("\n - "))
  process.exit(1)
}
console.log("All PR3 acceptance checks passed.\n")
