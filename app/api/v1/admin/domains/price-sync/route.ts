import { z, dbId } from "@/lib/zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { NotFoundError } from "@/lib/core/errors"
import { SETTING_KEYS, getSetting, toNumber } from "@/lib/core/settings"
import { DEFAULT_MARGIN_PERCENT, DEFAULT_MAX_USD } from "@/lib/core/domains/pricing"
import {
  getActiveUsdRate,
  getPriceSyncJob,
  startPriceSyncJob,
  stepPriceSyncJob,
} from "@/lib/core/domains/price-sync-service"

/**
 * Chunked TLD price sync. The client calls `start` once, then `step` in a loop
 * until `done`, which keeps every individual request well inside the serverless
 * time limit while a full ~467-zone run completes.
 */

/** Current dialog defaults + last-run info, so the UI opens pre-filled. */
export const GET = route(async (req: Request) => {
  await requireAdmin()
  const jobId = new URL(req.url).searchParams.get("jobId")

  if (jobId) {
    const progress = await getPriceSyncJob(jobId)
    if (!progress) throw new NotFoundError("عملیات موردنظر پیدا نشد.")
    return progress
  }

  const [margin, maxUsd, probeQuery, lastSyncAt, usdRate] = await Promise.all([
    getSetting(SETTING_KEYS.domainPriceMarginPercent),
    getSetting(SETTING_KEYS.domainPriceMaxUsd),
    getSetting(SETTING_KEYS.domainPriceProbeQuery),
    getSetting(SETTING_KEYS.domainPriceLastSyncAt),
    getActiveUsdRate(),
  ])
  const lastMs = toNumber(lastSyncAt, 0)
  return {
    discountPercent: toNumber(margin, DEFAULT_MARGIN_PERCENT),
    maxUsd: toNumber(maxUsd, DEFAULT_MAX_USD),
    probeQuery,
    usdRate,
    lastSyncAt: lastMs > 0 ? new Date(lastMs).toISOString() : null,
  }
})

const startSchema = z.object({
  action: z.literal("start"),
  mode: z.enum(["IMPORT", "REFRESH"]),
  // Cost ceiling in USD. Capped so a typo can't pull in $10k premium zones.
  maxUsd: z.coerce.number().min(1).max(1000).default(DEFAULT_MAX_USD),
  // 0 means "sell at cost"; 95 is the practical ceiling before prices vanish.
  discountPercent: z.coerce.number().int().min(0).max(95).default(DEFAULT_MARGIN_PERCENT),
  probeQuery: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{6,40}$/).optional(),
})

const stepSchema = z.object({ action: z.literal("step"), jobId: dbId })

const bodySchema = z.union([startSchema, stepSchema])

export const POST = route(async (req: Request) => {
  const admin = await requireAdmin()
  const body = bodySchema.parse(await req.json())

  if (body.action === "start") {
    return startPriceSyncJob({
      mode: body.mode,
      maxUsd: body.maxUsd,
      discountPercent: body.discountPercent,
      probeQuery: body.probeQuery,
      actorId: admin.id,
    })
  }

  const progress = await stepPriceSyncJob(body.jobId, admin.id)
  if (!progress) throw new NotFoundError("عملیات موردنظر پیدا نشد.")
  return progress
})
