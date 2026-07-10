import { createHash } from "crypto"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import type { RiskContext } from "./types"

type Db = Prisma.TransactionClient | typeof prisma

/**
 * Per-deployment salt so signal hashes can't be correlated across environments
 * or rainbow-tabled back to a raw IP. Falls back to a constant only when unset
 * (dev), which still keeps the values non-reversible in the DB.
 */
const SALT = process.env.REFERRAL_SIGNAL_SALT || process.env.AUTH_SECRET || "subio-referral-salt"

function h(value: string): string {
  return createHash("sha256").update(`${SALT}:${value}`).digest("hex").slice(0, 32)
}

/** IPv4 /24 or IPv6 /48 subnet key, for burst detection across a network. */
function subnetOf(ip: string): string {
  if (ip.includes(":")) return ip.split(":").slice(0, 3).join(":") // IPv6 /48-ish
  const parts = ip.split(".")
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}` // IPv4 /24
  return ip
}

export interface CapturedSignal {
  ipHash: string | null
  subnetHash: string | null
  uaHash: string | null
  deviceHash: string | null
}

/** Hash a raw risk context into the storable, non-reversible signal shape. */
export function hashContext(ctx: RiskContext | null | undefined): CapturedSignal {
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
 * Persist a hashed anti-abuse signal for an invited user. Best-effort and
 * idempotent-ish: one row per capture; safe to call inside or outside a tx.
 */
export async function captureSignal(
  subjectUserId: string,
  ctx: RiskContext | null | undefined,
  db: Db = prisma,
): Promise<CapturedSignal> {
  const sig = hashContext(ctx)
  try {
    await db.referralRiskSignal.create({
      data: {
        subjectUserId,
        source: ctx?.source ?? "web",
        ipHash: sig.ipHash,
        subnetHash: sig.subnetHash,
        uaHash: sig.uaHash,
        deviceHash: sig.deviceHash,
      },
    })
  } catch (e) {
    console.log("[v0] captureSignal error:", (e as Error).message)
  }
  return sig
}

/** Latest stored signal for a user (used by the risk engine at reward time). */
export async function getSignalFor(
  subjectUserId: string,
  db: Db = prisma,
): Promise<CapturedSignal | null> {
  const row = await db.referralRiskSignal.findFirst({
    where: { subjectUserId },
    orderBy: { createdAt: "desc" },
  })
  if (!row) return null
  return {
    ipHash: row.ipHash,
    subnetHash: row.subnetHash,
    uaHash: row.uaHash,
    deviceHash: row.deviceHash,
  }
}

export interface ClusterCounts {
  sameIp: number
  sameSubnet: number
  sameDevice: number
}

/**
 * How many DISTINCT users share each hashed signal (excluding the subject).
 * Used to detect same-device clusters and same-network bursts.
 */
export async function clusterCounts(
  subjectUserId: string,
  sig: CapturedSignal,
  db: Db = prisma,
): Promise<ClusterCounts> {
  const distinct = async (field: "ipHash" | "subnetHash" | "deviceHash", value: string | null) => {
    if (!value) return 0
    const rows = await db.referralRiskSignal.findMany({
      where: { [field]: value, subjectUserId: { not: subjectUserId } },
      select: { subjectUserId: true },
      distinct: ["subjectUserId"],
      take: 500,
    })
    return rows.length
  }
  const [sameIp, sameSubnet, sameDevice] = await Promise.all([
    distinct("ipHash", sig.ipHash),
    distinct("subnetHash", sig.subnetHash),
    distinct("deviceHash", sig.deviceHash),
  ])
  return { sameIp, sameSubnet, sameDevice }
}
