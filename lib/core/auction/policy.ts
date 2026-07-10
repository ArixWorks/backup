/**
 * AuctionPolicyService — the config core of the Smart Auction Engine.
 *
 * The global policy is one JSON `Setting` (`auction.policy`); each auction may
 * carry a partial override in `Auction.policyJson`, merged over the global.
 * Nothing about auction behaviour is hardcoded at a call site: pricing,
 * lifecycle, wallet, timer and anti-fraud all read the resolved policy.
 *
 * Mirrors the referral engine's policy pattern (normalize + defaults + atomic
 * JSON setting) so admin settings UI and cache-invalidation are reused.
 */

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { SETTING_KEYS, getSetting, setSetting } from "@/lib/core/settings"
import {
  type AuctionPolicy,
  type BuyNowStrategy,
  type BidIncrementStrategy,
  type WalletFreezeMode,
  type ReserveVisibility,
  type RiskAction,
  type PaymentDefaultAction,
  type IncrementTier,
  BUY_NOW_STRATEGIES,
  BID_INCREMENT_STRATEGIES,
  WALLET_FREEZE_MODES,
  RESERVE_VISIBILITY,
  RISK_ACTIONS,
  PAYMENT_DEFAULT_ACTIONS,
} from "./types"

type Db = Prisma.TransactionClient | typeof prisma

/**
 * Built-in defaults. Chosen to preserve today's behaviour where relevant while
 * enabling the new protections (smart Buy Now, reserve, soft close) by default.
 */
export const DEFAULT_AUCTION_POLICY: AuctionPolicy = {
  smartBuyNowEnabled: true,
  buyNowStrategy: "DYNAMIC_SMART_PRICE",
  buyNowDisableThresholdPercent: 80,
  buyNowPremiumPercent: 15,
  buyNowMinimumGapFromNextBid: 1,

  reservePriceEnabled: true,
  reservePriceVisibility: "HIDDEN_OR_PARTIAL",

  softCloseEnabled: true,
  softCloseWindowSeconds: 120,
  softCloseExtensionSeconds: 120,
  maxSoftCloseExtensions: 10,

  bidIncrementStrategy: "TIERED",
  minimumIncrementRules: [
    { upTo: 500_000, increment: 10_000 },
    { upTo: 2_000_000, increment: 50_000 },
    { upTo: 10_000_000, increment: 250_000 },
    { upTo: null, increment: 500_000 },
  ],

  walletFreezeEnabled: true,
  walletFreezeMode: "FULL_BID_OR_DEPOSIT",
  walletFreezePercent: 100,
  entryDepositEnabled: false,
  entryDepositAmount: null,

  paymentDeadlineMinutes: 30,
  paymentDefaultAction: "SECOND_CHANCE",
  secondChanceOfferEnabled: true,
  secondChanceWindowMinutes: 60,

  // Proxy bidding: schema is ready (Bid.maxAmount / Bid.isAuto) but full
  // execution stays OFF until its dedicated PR. Foundation-only for now.
  proxyBidEnabled: false,

  showWinnerOnEndedCard: true,
  showBidderDisplayName: true,
  maskBidderIdentity: true,

  fomoTimerEnabled: true,
  endingSoonThresholdSeconds: 300,
  criticalThresholdSeconds: 120,

  auctionAntiFraudEnabled: true,
  antiFraudDefaultAction: "MANUAL_REVIEW",
}

function inSet<T extends string>(v: unknown, set: readonly T[]): v is T {
  return typeof v === "string" && (set as readonly string[]).includes(v)
}

function normalizeTiers(raw: unknown): IncrementTier[] {
  if (!Array.isArray(raw)) return DEFAULT_AUCTION_POLICY.minimumIncrementRules
  const tiers: IncrementTier[] = []
  for (const r of raw) {
    if (!r || typeof r !== "object") continue
    const o = r as Record<string, unknown>
    const upTo = o.upTo === null ? null : Number(o.upTo)
    const increment = Number(o.increment)
    if (!Number.isFinite(increment) || increment <= 0) continue
    if (upTo !== null && (!Number.isFinite(upTo) || upTo <= 0)) continue
    tiers.push({ upTo, increment: Math.round(increment) })
  }
  if (tiers.length === 0) return DEFAULT_AUCTION_POLICY.minimumIncrementRules
  // Sort ascending by bound; open-ended (null) tier goes last.
  tiers.sort((a, b) => {
    if (a.upTo === null) return 1
    if (b.upTo === null) return -1
    return a.upTo - b.upTo
  })
  return tiers
}

/** Coerce an arbitrary parsed object into a complete, valid policy. */
export function normalizeAuctionPolicy(raw: unknown): AuctionPolicy {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_AUCTION_POLICY }
  const p = raw as Record<string, unknown>
  const out: AuctionPolicy = {
    ...DEFAULT_AUCTION_POLICY,
    minimumIncrementRules: [...DEFAULT_AUCTION_POLICY.minimumIncrementRules],
  }

  for (const key of Object.keys(DEFAULT_AUCTION_POLICY) as (keyof AuctionPolicy)[]) {
    const v = p[key]
    if (v === undefined || v === null) continue
    const def = DEFAULT_AUCTION_POLICY[key]
    if (typeof def === "boolean" && typeof v === "boolean") (out[key] as boolean) = v
    else if (typeof def === "number" && typeof v === "number" && Number.isFinite(v))
      (out[key] as number) = v
  }

  // Constrained string enums.
  if (inSet<BuyNowStrategy>(p.buyNowStrategy, BUY_NOW_STRATEGIES)) out.buyNowStrategy = p.buyNowStrategy
  if (inSet<BidIncrementStrategy>(p.bidIncrementStrategy, BID_INCREMENT_STRATEGIES))
    out.bidIncrementStrategy = p.bidIncrementStrategy
  if (inSet<WalletFreezeMode>(p.walletFreezeMode, WALLET_FREEZE_MODES)) out.walletFreezeMode = p.walletFreezeMode
  if (inSet<ReserveVisibility>(p.reservePriceVisibility, RESERVE_VISIBILITY))
    out.reservePriceVisibility = p.reservePriceVisibility
  if (inSet<RiskAction>(p.antiFraudDefaultAction, RISK_ACTIONS))
    out.antiFraudDefaultAction = p.antiFraudDefaultAction
  if (inSet<PaymentDefaultAction>(p.paymentDefaultAction, PAYMENT_DEFAULT_ACTIONS))
    out.paymentDefaultAction = p.paymentDefaultAction

  // Nullable number.
  if (p.entryDepositAmount === null) out.entryDepositAmount = null
  else if (typeof p.entryDepositAmount === "number" && Number.isFinite(p.entryDepositAmount))
    out.entryDepositAmount = Math.max(0, Math.round(p.entryDepositAmount))

  // Tiers.
  out.minimumIncrementRules = normalizeTiers(p.minimumIncrementRules)

  // Guard invariants.
  out.buyNowPremiumPercent = Math.max(0, out.buyNowPremiumPercent)
  out.buyNowMinimumGapFromNextBid = Math.max(0, Math.round(out.buyNowMinimumGapFromNextBid))
  out.buyNowDisableThresholdPercent = clamp(out.buyNowDisableThresholdPercent, 0, 100)
  out.walletFreezePercent = clamp(out.walletFreezePercent, 0, 100)
  out.softCloseWindowSeconds = Math.max(0, Math.round(out.softCloseWindowSeconds))
  out.softCloseExtensionSeconds = Math.max(0, Math.round(out.softCloseExtensionSeconds))
  out.maxSoftCloseExtensions = Math.max(0, Math.round(out.maxSoftCloseExtensions))
  out.paymentDeadlineMinutes = Math.max(0, Math.round(out.paymentDeadlineMinutes))
  out.secondChanceWindowMinutes = Math.max(0, Math.round(out.secondChanceWindowMinutes))
  out.endingSoonThresholdSeconds = Math.max(0, Math.round(out.endingSoonThresholdSeconds))
  out.criticalThresholdSeconds = Math.max(0, Math.round(out.criticalThresholdSeconds))
  // Critical threshold must not exceed ending-soon threshold.
  if (out.criticalThresholdSeconds > out.endingSoonThresholdSeconds)
    out.criticalThresholdSeconds = out.endingSoonThresholdSeconds

  return out
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.round(n)))
}

/** Read the global auction policy, falling back to the built-in default. */
export async function getGlobalAuctionPolicy(db: Db = prisma): Promise<AuctionPolicy> {
  const raw = await getSetting(SETTING_KEYS.auctionPolicy, db)
  if (!raw.trim()) return { ...DEFAULT_AUCTION_POLICY }
  try {
    return normalizeAuctionPolicy(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_AUCTION_POLICY }
  }
}

/** Persist a (partial) global policy update, merged over the current policy. */
export async function setGlobalAuctionPolicy(patch: Partial<AuctionPolicy>): Promise<AuctionPolicy> {
  const current = await getGlobalAuctionPolicy()
  const next = normalizeAuctionPolicy({ ...current, ...patch })
  await setSetting(SETTING_KEYS.auctionPolicy, JSON.stringify(next))
  return next
}

/**
 * Resolve the effective policy for one auction: global policy with the
 * auction's `policyJson` partial override merged on top. Accepts either a raw
 * JSON string (the column) or a pre-parsed object.
 */
export function resolveAuctionPolicy(
  global: AuctionPolicy,
  override?: string | Record<string, unknown> | null,
): AuctionPolicy {
  if (!override) return global
  let parsed: unknown = override
  if (typeof override === "string") {
    if (!override.trim()) return global
    try {
      parsed = JSON.parse(override)
    } catch {
      return global
    }
  }
  return normalizeAuctionPolicy({ ...global, ...(parsed as Record<string, unknown>) })
}

/** Convenience: load global + resolve for a specific auction's override JSON. */
export async function getAuctionPolicy(
  overrideJson?: string | null,
  db: Db = prisma,
): Promise<AuctionPolicy> {
  const global = await getGlobalAuctionPolicy(db)
  return resolveAuctionPolicy(global, overrideJson)
}
