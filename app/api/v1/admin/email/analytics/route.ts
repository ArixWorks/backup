import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { getEmailStats, getTemplateBreakdown, getDailyVolume } from "@/lib/email/analytics"

export const dynamic = "force-dynamic"

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(14),
})

/** Aggregated email KPIs + per-template breakdown + daily volume. */
export const GET = route(async (req: Request) => {
  await requireAdmin()
  const url = new URL(req.url)
  const { days } = querySchema.parse(Object.fromEntries(url.searchParams.entries()))
  const [stats, byTemplate, daily] = await Promise.all([
    getEmailStats(days),
    getTemplateBreakdown(days),
    getDailyVolume(days),
  ])
  return { days, stats, byTemplate, daily }
})
