/**
 * FACTORY RESET — wipes all demo/transactional data so you can launch the shop
 * with a clean slate, while PRESERVING structural data.
 *
 *   CONFIRM_RESET=ERASE pnpm exec tsx scripts/reset-data.ts
 *   # or: CONFIRM_RESET=ERASE pnpm db:reset
 *
 * It refuses to run without the explicit CONFIRM_RESET=ERASE guard so it can
 * never be triggered by accident.
 *
 * DELETED (demo + live transactional data):
 *   users, wallets, balances, ledger, deposits/withdrawals/refunds, products,
 *   inventory, fixed sales, auctions, bids, orders, deliveries, coupons,
 *   giveaways, reviews, support tickets, notifications, audit logs, points,
 *   user badges/missions, and runtime monitoring samples/events.
 *
 * PRESERVED (structural — re-tunable from the dashboard):
 *   Setting, BotSetting, Currency, ExchangeRate, Badge, Mission, AlertRule.
 *
 * After running this, also run `pnpm db:seed:prod` (idempotent) to guarantee
 * structural rows exist, then have the owner open the Mini App to bootstrap
 * the admin via ADMIN_TELEGRAM_IDS.
 *
 * Self-contained (own PrismaClient, no aliases/server-only) to run under tsx.
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  if (process.env.CONFIRM_RESET !== "ERASE") {
    console.error(
      "Refusing to run. This permanently deletes all users & transactional data.\n" +
        "Re-run with the explicit guard:\n\n  CONFIRM_RESET=ERASE pnpm db:reset\n",
    )
    process.exit(1)
  }

  // Delete children before parents to respect FK constraints. Each step is
  // wrapped so a model with no rows / already-cascaded rows can't abort the run.
  const steps: Array<[string, () => Promise<unknown>]> = [
    // Monitoring / runtime telemetry (keep AlertRule, drop its events + samples)
    ["alertEvent", () => prisma.alertEvent.deleteMany()],
    ["metricSample", () => prisma.metricSample.deleteMany()],
    ["errorEvent", () => prisma.errorEvent.deleteMany()],
    ["serviceHealth", () => prisma.serviceHealth.deleteMany()],
    // Support
    ["ticketMessage", () => prisma.ticketMessage.deleteMany()],
    ["supportTicket", () => prisma.supportTicket.deleteMany()],
    // Reviews & deliveries
    ["review", () => prisma.review.deleteMany()],
    ["delivery", () => prisma.delivery.deleteMany()],
    // Orders
    ["order", () => prisma.order.deleteMany()],
    // Auctions
    ["bid", () => prisma.bid.deleteMany()],
    ["watchlistEntry", () => prisma.watchlistEntry.deleteMany()],
    ["stockAlert", () => prisma.stockAlert.deleteMany()],
    ["auction", () => prisma.auction.deleteMany()],
    // Giveaways
    ["giveawayWinner", () => prisma.giveawayWinner.deleteMany()],
    ["giveawayEntry", () => prisma.giveawayEntry.deleteMany()],
    ["giveaway", () => prisma.giveaway.deleteMany()],
    // Catalog
    ["fixedSale", () => prisma.fixedSale.deleteMany()],
    ["inventoryItem", () => prisma.inventoryItem.deleteMany()],
    ["categoryFollow", () => prisma.categoryFollow.deleteMany()],
    ["product", () => prisma.product.deleteMany()],
    // Coupons
    ["couponRedemption", () => prisma.couponRedemption.deleteMany()],
    ["coupon", () => prisma.coupon.deleteMany()],
    // Finance: requests
    ["refundRequest", () => prisma.refundRequest.deleteMany()],
    ["withdrawalRequest", () => prisma.withdrawalRequest.deleteMany()],
    ["depositRequest", () => prisma.depositRequest.deleteMany()],
    // Finance: ledger (legs -> entries -> accounts)
    ["ledgerLeg", () => prisma.ledgerLeg.deleteMany()],
    ["ledgerEntry", () => prisma.ledgerEntry.deleteMany()],
    ["ledgerAccount", () => prisma.ledgerAccount.deleteMany()],
    ["currencyConversion", () => prisma.currencyConversion.deleteMany()],
    // Wallets
    ["walletTransaction", () => prisma.walletTransaction.deleteMany()],
    ["wallet", () => prisma.wallet.deleteMany()],
    // Gamification per-user data
    ["pointLedger", () => prisma.pointLedger.deleteMany()],
    ["userBadge", () => prisma.userBadge.deleteMany()],
    ["userMission", () => prisma.userMission.deleteMany()],
    // User-scoped misc
    ["notification", () => prisma.notification.deleteMany()],
    ["auditLog", () => prisma.auditLog.deleteMany()],
    ["authToken", () => prisma.authToken.deleteMany()],
    // Finally, users
    ["user", () => prisma.user.deleteMany()],
  ]

  let total = 0
  for (const [name, fn] of steps) {
    try {
      const res = (await fn()) as { count?: number }
      const n = res?.count ?? 0
      total += n
      if (n > 0) console.log(`[reset] ${name}: ${n}`)
    } catch (e) {
      console.warn(`[reset] ${name}: skipped (${(e as Error).message})`)
    }
  }

  console.log(`[reset] done — deleted ${total} rows. Structural data preserved.`)
  console.log("[reset] next: run `pnpm db:seed:prod`, then open the Mini App as the ADMIN_TELEGRAM_IDS owner.")
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
