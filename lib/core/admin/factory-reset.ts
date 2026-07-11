import "server-only"
import { randomBytes } from "node:crypto"
import { prisma } from "@/lib/db"
import { hashPassword } from "@/lib/auth/password"
import { BASE_CURRENCY } from "@/lib/core/ledger"
import { DEFAULT_ADMIN_TELEGRAM_IDS } from "@/lib/telegram/user"

/**
 * FACTORY RESET (dashboard-triggered).
 *
 * Mirrors scripts/reset-data.ts but callable from the owner-only admin API. It
 * permanently wipes all users + transactional data while PRESERVING structural
 * data (Setting, BotSetting, Currency, ExchangeRate, Badge, Mission, AlertRule),
 * then immediately re-creates the permanent owner admin so the operator is never
 * locked out.
 *
 * Owner identity is resolved from env with safe non-secret defaults:
 *   ADMIN_EMAIL        (default: the built-in owner email)
 *   ADMIN_TELEGRAM_ID  (default: the built-in owner Telegram id)
 *   ADMIN_USERNAME     (default: the built-in owner username)
 *   ADMIN_PASSWORD     (secret; NEVER hardcoded — read from env only)
 *
 * If ADMIN_PASSWORD is unset the owner is re-created as a Telegram-only admin
 * (they can still log in via the Mini App, since their Telegram id is a
 * permanent bootstrap admin) and can set a password later from account settings.
 */

// Non-secret owner identifiers. The Telegram id is already the permanent
// bootstrap owner (DEFAULT_ADMIN_TELEGRAM_IDS), so it is not a secret.
export const OWNER_DEFAULT_EMAIL = "a30006179@gmail.com"
export const OWNER_DEFAULT_USERNAME = "alirezaix"
export const OWNER_DEFAULT_TELEGRAM_ID = DEFAULT_ADMIN_TELEGRAM_IDS[0]

export interface FactoryResetResult {
  deletedRows: number
  owner: { id: string; email: string | null; telegramId: string | null; hasPassword: boolean }
}

/**
 * Ordered, FK-safe, tolerant deletes. Children before parents; each step is
 * isolated so a model with no rows (or already cascaded) can never abort the run.
 */
async function wipeTransactionalData(): Promise<number> {
  const steps: Array<[string, () => Promise<{ count: number }>]> = [
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
    // Auctions (incl. anti-fraud signals/flags added in later PRs)
    ["auctionBidSignal", () => prisma.auctionBidSignal.deleteMany()],
    ["auctionRiskFlag", () => prisma.auctionRiskFlag.deleteMany()],
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
    // Referral engine (scalar user ids — orphaned after a user wipe)
    ["referralReward", () => prisma.referralReward.deleteMany()],
    ["referralRiskSignal", () => prisma.referralRiskSignal.deleteMany()],
    ["referralRelation", () => prisma.referralRelation.deleteMany()],
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
      const res = await fn()
      total += res?.count ?? 0
    } catch (e) {
      console.log(`[v0] factory-reset: skipped ${name} (${(e as Error).message})`)
    }
  }
  return total
}

/**
 * Re-create (or promote) the permanent owner admin from env-resolved identity.
 * Returns the owner user so the API layer can issue a fresh session.
 */
async function reseedOwnerAdmin() {
  const email = (process.env.ADMIN_EMAIL || OWNER_DEFAULT_EMAIL).toLowerCase().trim()
  const username = (process.env.ADMIN_USERNAME || OWNER_DEFAULT_USERNAME).trim()
  const telegramId = (process.env.ADMIN_TELEGRAM_ID || OWNER_DEFAULT_TELEGRAM_ID).trim()
  const password = process.env.ADMIN_PASSWORD || ""
  const passwordHash = password ? await hashPassword(password) : null

  const owner = await prisma.user.create({
    data: {
      email,
      username,
      passwordHash,
      emailVerified: true,
      lastLoginMethod: password ? "password" : "telegram",
      telegramId,
      telegramChatId: telegramId,
      telegramUsername: username,
      displayName: "Alireza",
      alias: `Owner#${randomBytes(2).toString("hex")}`,
      role: "ADMIN",
      status: "ACTIVE",
      wallets: { create: { currency: BASE_CURRENCY, totalBalance: 0n } },
    },
  })

  return { owner, hasPassword: Boolean(passwordHash) }
}

/**
 * Full sequence: wipe → reseed owner. The audit trail is written by the caller
 * AFTER this returns (the wipe clears AuditLog, so logging earlier is pointless).
 */
export async function runFactoryReset(): Promise<FactoryResetResult> {
  const deletedRows = await wipeTransactionalData()
  const { owner, hasPassword } = await reseedOwnerAdmin()
  return {
    deletedRows,
    owner: { id: owner.id, email: owner.email, telegramId: owner.telegramId, hasPassword },
  }
}
