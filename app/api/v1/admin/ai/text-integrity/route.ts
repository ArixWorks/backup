import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { rateLimitBy } from "@/lib/api/rate-limit"
import { listTextIntegrityFindings, runTextIntegrityScan } from "@/lib/ai/text-integrity"

export const dynamic = "force-dynamic"

const statusSchema = z.enum(["PENDING", "APPROVED", "REJECTED", "STALE", "RESOLVED"])

export const GET = route(async (req: Request) => {
  await requireAdmin()
  const raw = new URL(req.url).searchParams.get("status")
  const status = raw ? statusSchema.parse(raw) : undefined
  return listTextIntegrityFindings(status)
})

export const POST = route(async () => {
  const admin = await requireAdmin()
  await rateLimitBy(admin.id, { bucket: "text-integrity:scan", limit: 3, windowSec: 600 })
  return runTextIntegrityScan()
})
