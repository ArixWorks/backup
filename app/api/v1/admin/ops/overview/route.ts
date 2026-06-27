import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { getOverview } from "@/lib/monitoring/queries"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export const GET = route(async () => {
  await requireAdmin()
  return getOverview()
})
