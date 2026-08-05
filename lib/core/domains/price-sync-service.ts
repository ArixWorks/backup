import "server-only"
import type { DomainPriceSyncMode } from "@prisma/client"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/core/audit"
import { getBotConfig } from "@/lib/telegram/settings"
import { DEFAULT_USD_RATE } from "@/lib/i18n/currency"
import { SETTING_KEYS, getSetting, setSettings, toNumber } from "@/lib/core/settings"
import { derivePrice, normalizeMarginPercent, DEFAULT_MARGIN_PERCENT, DEFAULT_MAX_USD } from "./pricing"
import { discoverZones, fetchZonePrices, type DiscoveredZone } from "./price-sync"

/**
 * Orchestrates the Railway price import as a resumable job.
 *
 * A full catalog run is ~467 zones over ~12 socket round trips. Doing that in
 * one HTTP request sits uncomfortably close to the serverless time limit, so the
 * work is split: `startPriceSyncJob` does the cheap discovery pass and persists
 * the zone list, then the client calls `stepPriceSyncJob` repeatedly until the
 * cursor reaches the end. Progress lives in the database, so a dropped
 * connection or a cold start resumes instead of starting over.
 *
 * Safety property: this only ever creates or updates rows. A failed or partial
 * run therefore degrades to "fewer TLDs updated" and can never empty or corrupt
 * a live catalog.
 */

/** Zones handled per `step` call. Two socket batches, comfortably inside limits. */
const ZONES_PER_STEP = 80

/** Guards against a pathological discovery response. */
const MAX_ZONES = 2_000

export interface PriceSyncProgress {
  jobId: string
  mode: DomainPriceSyncMode
  status: "RUNNING" | "DONE" | "FAILED"
  total: number
  processed: number
  found: number
  created: number
  updated: number
  skipped: number
  lastError: string | null
  done: boolean
}

/** Display USD rate (Toman per 1 USD) that Toman prices are derived from. */
export async function getActiveUsdRate(): Promise<number> {
  // Prefer the live Wallex-buffered rate; fall back to the bot display rate.
  const wallex = toNumber(await getSetting(SETTING_KEYS.wallexUsdToman), 0)
  if (wallex > 0) return wallex
  const config = await getBotConfig()
  const rate = Number(config.usdRate)
  return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_USD_RATE
}

/**
 * Human-friendly default title for a freshly imported TLD. Deliberately not
 * ".actor", which would just repeat the neighbouring TLD column in the admin
 * table; admins can replace it with a Persian label, and an existing title is
 * never overwritten by a later sync.
 */
function titleForZone(zone: string): string {
  return zone.charAt(0).toUpperCase() + zone.slice(1)
}

function toProgress(job: {
  id: string
  mode: DomainPriceSyncMode
  status: "RUNNING" | "DONE" | "FAILED"
  total: number
  cursor: number
  found: number
  created: number
  updated: number
  skipped: number
  lastError: string | null
}): PriceSyncProgress {
  return {
    jobId: job.id,
    mode: job.mode,
    status: job.status,
    total: job.total,
    processed: Math.min(job.cursor, job.total),
    found: job.found,
    created: job.created,
    updated: job.updated,
    skipped: job.skipped,
    lastError: job.lastError,
    done: job.status !== "RUNNING",
  }
}

export interface StartPriceSyncInput {
  mode: DomainPriceSyncMode
  maxUsd: number
  discountPercent: number
  probeQuery?: string
  actorId?: string | null
}

/**
 * Discovery pass: ask the provider which zones exist, persist the list, and
 * remember the admin's chosen ceiling/discount for next time.
 */
export async function startPriceSyncJob(input: StartPriceSyncInput): Promise<PriceSyncProgress> {
  const probeQuery =
    (input.probeQuery?.trim() || (await getSetting(SETTING_KEYS.domainPriceProbeQuery)) || "safoaghkgoasfgakas")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 40) || "safoaghkgoasfgakas"

  const maxUsd = Number.isFinite(input.maxUsd) && input.maxUsd > 0 ? input.maxUsd : DEFAULT_MAX_USD
  const maxUsdCents = Math.round(maxUsd * 100)
  const discountPercent = normalizeMarginPercent(input.discountPercent)

  let zones: DiscoveredZone[] = []
  try {
    zones = await discoverZones(probeQuery)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failed = await prisma.domainPriceSyncJob.create({
      data: {
        mode: input.mode,
        status: "FAILED",
        probeQuery,
        maxUsdCents,
        discountPercent,
        lastError: message,
        finishedAt: new Date(),
      },
    })
    return toProgress(failed)
  }

  if (zones.length > MAX_ZONES) zones = zones.slice(0, MAX_ZONES)

  // REFRESH only touches TLDs we already sell, so narrow the work up front
  // instead of re-pricing the provider's entire catalog.
  if (input.mode === "REFRESH") {
    const existing = await prisma.domainTld.findMany({ select: { tld: true } })
    const owned = new Set(existing.map((row) => row.tld.replace(/^\./, "").toLowerCase()))
    zones = zones.filter((z) => owned.has(z.zone))
  }

  const job = await prisma.domainPriceSyncJob.create({
    data: {
      mode: input.mode,
      status: zones.length === 0 ? "DONE" : "RUNNING",
      probeQuery,
      maxUsdCents,
      discountPercent,
      discovered: zones as unknown as object,
      total: zones.length,
      finishedAt: zones.length === 0 ? new Date() : null,
    },
  })

  await setSettings({
    [SETTING_KEYS.domainPriceMarginPercent]: String(discountPercent),
    [SETTING_KEYS.domainPriceMaxUsd]: String(maxUsd),
    [SETTING_KEYS.domainPriceProbeQuery]: probeQuery,
  }).catch(() => {})

  await audit({
    actorId: input.actorId ?? null,
    action: "domain.price.sync.start",
    entity: "DomainPriceSyncJob",
    entityId: job.id,
    meta: { mode: input.mode, zones: zones.length, maxUsd, discountPercent, probeQuery },
  }).catch(() => {})

  return toProgress(job)
}

/**
 * Price and persist the next slice of zones.
 *
 * IMPORT creates TLDs that are purchasable and under the cost ceiling, and
 * refreshes the cost of ones that already exist. REFRESH updates existing rows
 * only. Either way, admin-authored fields (`title`, `active`, `displayOrder`)
 * are never overwritten after creation.
 */
export async function stepPriceSyncJob(jobId: string, actorId?: string | null): Promise<PriceSyncProgress | null> {
  const job = await prisma.domainPriceSyncJob.findUnique({ where: { id: jobId } })
  if (!job) return null
  if (job.status !== "RUNNING") return toProgress(job)

  const zones = Array.isArray(job.discovered) ? (job.discovered as unknown as DiscoveredZone[]) : []
  const slice = zones.slice(job.cursor, job.cursor + ZONES_PER_STEP)

  if (slice.length === 0) {
    const finished = await prisma.domainPriceSyncJob.update({
      where: { id: job.id },
      data: { status: "DONE", finishedAt: new Date(), cursor: job.total },
    })
    await setSettings({ [SETTING_KEYS.domainPriceLastSyncAt]: String(Date.now()) }).catch(() => {})
    await audit({
      actorId: actorId ?? null,
      action: "domain.price.sync.finish",
      entity: "DomainPriceSyncJob",
      entityId: job.id,
      meta: {
        mode: finished.mode,
        found: finished.found,
        created: finished.created,
        updated: finished.updated,
        skipped: finished.skipped,
      },
    }).catch(() => {})
    return toProgress(finished)
  }

  let prices: Map<string, { zone: string; costCents: number; purchasable: boolean }>
  try {
    prices = await fetchZonePrices(slice)
  } catch (error) {
    // A single bad slice shouldn't kill the whole run: record it and advance so
    // the remaining zones still get priced.
    const message = error instanceof Error ? error.message : String(error)
    const advanced = await prisma.domainPriceSyncJob.update({
      where: { id: job.id },
      data: {
        cursor: job.cursor + slice.length,
        skipped: { increment: slice.length },
        lastError: message,
      },
    })
    return toProgress(advanced)
  }

  const usdRate = await getActiveUsdRate()
  const existingRows = await prisma.domainTld.findMany({
    where: { tld: { in: slice.flatMap((z) => [z.zone, `.${z.zone}`]) } },
    select: { id: true, tld: true, costUsdCents: true, marginPercent: true, title: true },
  })
  const existingByZone = new Map(existingRows.map((row) => [row.tld.replace(/^\./, "").toLowerCase(), row]))

  let created = 0
  let updated = 0
  let skipped = 0

  for (const zone of slice) {
    const price = prices.get(zone.zone)
    const existing = existingByZone.get(zone.zone)

    // No usable provider price (a handful of zones never return one) — leave any
    // existing manual price untouched rather than zeroing it.
    if (!price || price.costCents <= 0) {
      skipped += 1
      continue
    }

    if (!existing) {
      if (job.mode === "REFRESH") {
        skipped += 1
        continue
      }
      if (!price.purchasable || price.costCents > job.maxUsdCents) {
        skipped += 1
        continue
      }
      const derived = derivePrice(price.costCents, job.discountPercent, usdRate)
      await prisma.domainTld.create({
        data: {
          // The catalog stores TLDs dot-prefixed (".com"), matching the admin
          // schema and everything that joins on this column.
          tld: `.${zone.zone}`,
          title: titleForZone(zone.zone),
          basePriceIrt: derived.basePriceIrt,
          listPriceIrt: derived.listPriceIrt,
          costUsdCents: derived.costUsdCents,
          sellUsdCents: derived.sellUsdCents,
          marginPercent: derived.marginPercent,
          lastPriceSyncAt: new Date(),
          active: true,
          supported: true,
          provider: "railway-domains",
        },
      })
      created += 1
      continue
    }

    // Existing row: only write when the provider cost actually moved, so a
    // no-op refresh reports 0 changes instead of churning every row.
    if (existing.costUsdCents === price.costCents) {
      skipped += 1
      continue
    }
    const derived = derivePrice(price.costCents, existing.marginPercent ?? job.discountPercent, usdRate)
    await prisma.domainTld.update({
      where: { id: existing.id },
      data: {
        basePriceIrt: derived.basePriceIrt,
        listPriceIrt: derived.listPriceIrt,
        costUsdCents: derived.costUsdCents,
        sellUsdCents: derived.sellUsdCents,
        marginPercent: derived.marginPercent,
        lastPriceSyncAt: new Date(),
      },
    })
    updated += 1
  }

  const advanced = await prisma.domainPriceSyncJob.update({
    where: { id: job.id },
    data: {
      cursor: job.cursor + slice.length,
      found: { increment: prices.size },
      created: { increment: created },
      updated: { increment: updated },
      skipped: { increment: skipped },
    },
  })

  // Reaching the end here saves the client one extra round trip.
  if (advanced.cursor >= advanced.total) {
    const finished = await prisma.domainPriceSyncJob.update({
      where: { id: job.id },
      data: { status: "DONE", finishedAt: new Date() },
    })
    await setSettings({ [SETTING_KEYS.domainPriceLastSyncAt]: String(Date.now()) }).catch(() => {})
    await audit({
      actorId: actorId ?? null,
      action: "domain.price.sync.finish",
      entity: "DomainPriceSyncJob",
      entityId: job.id,
      meta: {
        mode: finished.mode,
        found: finished.found,
        created: finished.created,
        updated: finished.updated,
        skipped: finished.skipped,
      },
    }).catch(() => {})
    return toProgress(finished)
  }

  return toProgress(advanced)
}

export async function getPriceSyncJob(jobId: string): Promise<PriceSyncProgress | null> {
  const job = await prisma.domainPriceSyncJob.findUnique({ where: { id: jobId } })
  return job ? toProgress(job) : null
}

/**
 * Re-derive Toman prices for every USD-priced TLD at the given rate.
 *
 * This is what makes the dollar-denominated catalog behave correctly for
 * Iranian customers: the admin sets a dollar price once, and each FX sync
 * rewrites Toman so the storefront never lags behind the market.
 */
export async function recalculateTomanPrices(usdRate: number): Promise<number> {
  if (!Number.isFinite(usdRate) || usdRate <= 0) return 0
  const rows = await prisma.domainTld.findMany({
    where: { sellUsdCents: { not: null } },
    select: { id: true, costUsdCents: true, sellUsdCents: true, marginPercent: true, basePriceIrt: true, listPriceIrt: true },
  })

  let changed = 0
  for (const row of rows) {
    const costCents = row.costUsdCents ?? row.sellUsdCents ?? 0
    if (costCents <= 0) continue
    const derived = derivePrice(costCents, row.marginPercent ?? DEFAULT_MARGIN_PERCENT, usdRate)
    if (derived.basePriceIrt === row.basePriceIrt && derived.listPriceIrt === row.listPriceIrt) continue
    await prisma.domainTld.update({
      where: { id: row.id },
      data: { basePriceIrt: derived.basePriceIrt, listPriceIrt: derived.listPriceIrt },
    })
    changed += 1
  }
  return changed
}
