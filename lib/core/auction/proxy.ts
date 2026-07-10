/**
 * AuctionProxyEngine — pure, policy-free auto-bid (proxy) resolution math.
 *
 * eBay-style semantics for a SINGLE-item auction: every participant has an
 * effective ceiling (their `maxAmount`, or their highest manual bid when they
 * never set a max). The item settles at just above the second-highest ceiling,
 * capped at the leader's ceiling — so the winner pays the minimum needed to beat
 * the runner-up, never their full max unless forced by a tie.
 *
 * No DB and no I/O here, so the logic is deterministic and trivially testable.
 * The caller (placeBid) loads the agents, runs `resolveProxyBids`, then emits
 * the returned auto-bid rows and settles the price.
 */

export interface ProxyAgent {
  userId: string
  /** Max this agent will pay: max(their maxAmount, their highest manual bid). */
  ceiling: bigint
  /** Their current highest actually-placed bid amount. */
  currentAmount: bigint
  /** When they reached `ceiling` (ms epoch) — earlier wins ceiling ties. */
  committedAt: number
}

export interface ProxyResolution {
  leaderUserId: string
  /** The leader's committed ceiling (used for the full-ceiling freeze). */
  leaderCeiling: bigint
  /** Final settled price for the item. */
  settlePrice: bigint
  /**
   * Auto-bids to emit so the visible price + standings reflect the outcome.
   * Ordered low → high so the leader's row is chronologically last.
   */
  autoBids: { userId: string; amount: bigint }[]
}

/**
 * Resolve a single-item proxy war. Returns null when there are no agents.
 *
 * @param agents        all participants with a bid on the auction
 * @param startPrice    the auction's opening price (floor)
 * @param incrementFor  minimum increment for a given price (from the pricing engine)
 */
export function resolveProxyBids(
  agents: ProxyAgent[],
  startPrice: bigint,
  incrementFor: (price: bigint) => bigint,
): ProxyResolution | null {
  if (agents.length === 0) return null

  // Highest ceiling wins; ties broken by who committed to that ceiling first.
  const sorted = [...agents].sort((a, b) =>
    a.ceiling !== b.ceiling ? (a.ceiling > b.ceiling ? -1 : 1) : a.committedAt - b.committedAt,
  )
  const leader = sorted[0]
  const runner = sorted[1]

  let settlePrice: bigint
  if (!runner) {
    // Sole bidder — no auto-raise; price is their current bid, floored at start.
    settlePrice = leader.currentAmount > startPrice ? leader.currentAmount : startPrice
  } else if (leader.ceiling === runner.ceiling) {
    // Equal ceilings: the earlier committer wins and pays the shared ceiling.
    settlePrice = leader.ceiling
  } else {
    // One increment above the runner-up's ceiling, capped at the leader's.
    const bump = runner.ceiling + incrementFor(runner.ceiling)
    settlePrice = bump < leader.ceiling ? bump : leader.ceiling
  }
  // Never settle below the opening price.
  if (settlePrice < startPrice) settlePrice = startPrice

  const autoBids: { userId: string; amount: bigint }[] = []
  // Push the runner-up up to their (losing) ceiling so the gap to the leader is
  // visible and their standing is accurate.
  if (runner && runner.ceiling < settlePrice && runner.currentAmount < runner.ceiling) {
    autoBids.push({ userId: runner.userId, amount: runner.ceiling })
  }
  // Raise the leader to the settle price when their current bid is below it.
  if (leader.currentAmount < settlePrice) {
    autoBids.push({ userId: leader.userId, amount: settlePrice })
  }

  return { leaderUserId: leader.userId, leaderCeiling: leader.ceiling, settlePrice, autoBids }
}
