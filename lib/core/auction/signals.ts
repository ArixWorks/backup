import { createHash } from "crypto"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

type Db = Prisma.TransactionClient | typeof prisma

/**
 * Raw, un-hashed anti-fraud context captured when a bid is placed. Hashed before
 * persistence so no identifiable network data is ever stored.
 */
export interface BidRiskContext {
  source?: "web" | "telegram"
  /** Client IP (web: x-forwarded-for). */
  ip?: string | null
  /** User-Agent header (web only). */
  userAgent?: string | null
  /** Stable device/client fingerprint if the client supplies one. */
  deviceId?: string | null
}

/**
 * Per-deployment salt so signal hashes can't be correlated across environments
 * or rainbow-tabled back to a raw IP. Reuses the referral salt for consistency,
 * falling back to AUTH_SECRET, then a constant (dev only, still non-reversible).
 */
const SALT =
  process.env.REFERRAL_SIGNAL_SALT || process.env.AUTH_SECRET || "subio-auction-salt"

function h(value: string): string {
  return createHash("sha256").update(`${SALT}:${value}`).digest("hex").slice(0, 32)
}

/** IPv4 /24 or IPv6 /48 subnet key, for burst detection across a network. */
function subnetOf(ip: string): string {
  if (ip.includes(":")) return ip.split(":").slice(0, 3).join(":")
  const parts = ip.split(".")
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}`
  return ip
}

export interface CapturedSignal {
  ipHash: string | null
  subnetHash: string | null
  uaHash: string | null
  deviceHash: string | null
}

/** Hash a raw bid context into the storable, non-reversible signal shape. */
export function hashBidContext(ctx: BidRiskContext | null | undefined): CapturedSignal {
  const ip = ctx?.ip?.trim()
  const ua = ctx?.userAgent?.trim()
  const device = ctx?.deviceId?.trim()
  return {
    ipHash: ip && ip !== "unknown" ? h(ip) : null,
    subnetHash: ip && ip !== "unknown" ? h(subnetOf(ip)) : null,
    uaHash: ua ? h(ua) : null,
    deviceHash: device ? h(device) : null,
  }
}

/**
 * Persist a hashed anti-fraud signal for a bid. Best-effort; safe inside a tx.
 * Returns the hashed signal so the caller can score without re-hashing.
 */
export async function captureBidSignal(
  auctionId: string,
  userId: string,
  ctx: BidRiskContext | null | undefined,
  db: Db = prisma,
): Promise<CapturedSignal> {
  const sig = hashBidContext(ctx)
  try {
    await db.auctionBidSignal.create({
      data: {
        auctionId,
        userId,
        source: ctx?.source ?? "web",
        ipHash: sig.ipHash,
        subnetHash: sig.subnetHash,
        uaHash: sig.uaHash,
        deviceHash: sig.deviceHash,
      },
    })
  } catch (e) {
    console.log("[v0] captureBidSignal error:", (e as Error).message)
  }
  return sig
}

export interface AuctionClusterCounts {
  /** DISTINCT other users on THIS auction sharing the bidder's IP hash. */
  sameIp: number
  /** DISTINCT other users on THIS auction sharing the bidder's /24 or /48. */
  sameSubnet: number
  /** DISTINCT other users on THIS auction sharing the bidder's device hash. */
  sameDevice: number
  /** DISTINCT other users on THIS auction sharing the bidder's user-agent hash. */
  sameUa: number
}

/**
 * How many DISTINCT OTHER users have bid on the SAME auction while sharing each
 * hashed signal with the current bidder. This is the core collusion detector:
 * multiple accounts driven from one device/network competing on one item.
 */
export async function auctionClusterCounts(
  auctionId: string,
  userId: string,
  sig: CapturedSignal,
  db: Db = prisma,
): Promise<AuctionClusterCounts> {
  const distinct = async (
    field: "ipHash" | "subnetHash" | "deviceHash" | "uaHash",
    value: string | null,
  ) => {
    if (!value) return 0
    const rows = await db.auctionBidSignal.findMany({
      where: { auctionId, [field]: value, userId: { not: userId } },
      select: { userId: true },
      distinct: ["userId"],
      take: 200,
    })
    return rows.length
  }
  const [sameIp, sameSubnet, sameDevice, sameUa] = await Promise.all([
    distinct("ipHash", sig.ipHash),
    distinct("subnetHash", sig.subnetHash),
    distinct("deviceHash", sig.deviceHash),
    distinct("uaHash", sig.uaHash),
  ])
  return { sameIp, sameSubnet, sameDevice, sameUa }
}
