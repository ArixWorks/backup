import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { getAuctionFraudOverview, resolveAuctionFraudFlag } from "@/lib/core/auction/fraud-admin"

export const dynamic = "force-dynamic"

export const GET = route(async () => {
  await requireAdmin()
  return getAuctionFraudOverview()
})

const resolveSchema = z.object({ flagId: z.string().trim().min(1) })

export const POST = route(async (req: Request) => {
  const admin = await requireAdmin()
  const { flagId } = resolveSchema.parse(await req.json())
  await resolveAuctionFraudFlag(flagId, admin.id)
  return { ok: true }
})
