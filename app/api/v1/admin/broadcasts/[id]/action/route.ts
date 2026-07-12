import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { queueDraft } from "@/lib/broadcast/core"
import { prisma } from "@/lib/db"

const schema = z.object({ action: z.enum(["SEND", "SCHEDULE", "PAUSE", "RESUME", "CANCEL", "RETRY"]), scheduledAt: z.string().datetime().optional() })

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin()
  const { id } = await ctx.params
  const body = schema.parse(await req.json())
  if (body.action === "SEND") await queueDraft(id)
  if (body.action === "SCHEDULE") await queueDraft(id, body.scheduledAt ? new Date(body.scheduledAt) : undefined)
  if (body.action === "PAUSE") await prisma.broadcastCampaign.updateMany({ where: { id, status: { in: ["QUEUED", "SENDING"] } }, data: { status: "PAUSED" } })
  if (body.action === "RESUME") await prisma.broadcastCampaign.updateMany({ where: { id, status: "PAUSED" }, data: { status: "QUEUED" } })
  if (body.action === "CANCEL") await prisma.broadcastCampaign.updateMany({ where: { id, status: { notIn: ["COMPLETED", "CANCELLED"] } }, data: { status: "CANCELLED", cancelledAt: new Date() } })
  if (body.action === "RETRY") {
    await prisma.$transaction([
      prisma.broadcastRecipient.updateMany({ where: { campaignId: id, telegramStatus: "FAILED" }, data: { telegramStatus: "PENDING", error: null } }),
      prisma.broadcastRecipient.updateMany({ where: { campaignId: id, webStatus: "FAILED" }, data: { webStatus: "PENDING", error: null } }),
      prisma.broadcastCampaign.update({ where: { id }, data: { status: "QUEUED", completedAt: null } }),
    ])
  }
  return { status: "ok" }
})
