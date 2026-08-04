import { z } from "@/lib/zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import {
  markDomainPurchased,
  completeDomainOrder,
  failDomainOrder,
  requestDomainExtension,
} from "@/lib/core/domains/service"

export const dynamic = "force-dynamic"

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("purchase"),
    providerReference: z.string().trim().max(200).optional(),
  }),
  z.object({ action: z.literal("complete") }),
  z.object({
    action: z.literal("fail"),
    reason: z.string().trim().min(1).max(200),
  }),
  z.object({
    action: z.literal("extend"),
    minutes: z.number().int().min(15).max(4320),
  }),
])

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  const { id } = await ctx.params
  const body = schema.parse(await req.json())

  switch (body.action) {
    case "purchase":
      return markDomainPurchased(id, admin.id, body.providerReference)
    case "complete":
      return completeDomainOrder(id, admin.id)
    case "fail":
      return failDomainOrder(id, admin.id, body.reason)
    case "extend":
      return requestDomainExtension(id, admin.id, body.minutes)
  }
})
