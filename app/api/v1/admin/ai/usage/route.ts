import { route } from "@/lib/api/handler"
import { requireAiAdmin } from "@/lib/ai/permissions"
import { getUsageSummary } from "@/lib/ai/usage"

export const dynamic = "force-dynamic"

export const GET = route(async (req: Request) => {
  await requireAiAdmin()
  const url = new URL(req.url)
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days")) || 30))
  return getUsageSummary(days)
})
