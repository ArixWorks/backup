import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { campaignInputSchema, createCampaign } from "@/lib/broadcast/core"
import { prisma } from "@/lib/db"
import { ValidationError } from "@/lib/core/errors"

export const dynamic = "force-dynamic"

export const GET = route(async (req: Request) => {
  await requireAdmin()
  const url = new URL(req.url)
  const status = url.searchParams.get("status")
  return prisma.broadcastCampaign.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
  })
})

export const POST = route(async (req: Request) => {
  const admin = await requireAdmin()
  const body = await req.json()
  const input = campaignInputSchema.parse(body)
  const action = body.action === "SEND" ? "SEND" : body.action === "SCHEDULE" ? "SCHEDULE" : "DRAFT"
  if (action === "SCHEDULE" && !input.scheduledAt) throw new ValidationError("زمان ارسال را انتخاب کنید")
  return createCampaign(input, admin.id, action)
})
