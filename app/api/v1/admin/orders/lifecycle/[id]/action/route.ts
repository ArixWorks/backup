import { z, dbId } from "@/lib/zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { completeOrder, requestExtension, cancelOrder } from "@/lib/core/order-lifecycle"
import { CANCEL_REASON_CODES } from "@/lib/orders/shared"

export const dynamic = "force-dynamic"

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("complete"),
    note: z.string().trim().max(2000).optional(),
    tutorialId: dbId.nullable().optional(),
  }),
  z.object({
    action: z.literal("extend"),
    minutes: z.number().int().min(1).max(24 * 60),
  }),
  z.object({
    action: z.literal("cancel"),
    reasonCode: z.enum(CANCEL_REASON_CODES).optional(),
    reason: z.string().trim().max(500).optional(),
  }),
])

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  const { id } = await ctx.params
  const body = schema.parse(await req.json())

  switch (body.action) {
    case "complete":
      return completeOrder(id, admin.id, { note: body.note ?? null, tutorialId: body.tutorialId ?? null })
    case "extend":
      return requestExtension(id, admin.id, body.minutes)
    case "cancel":
      return cancelOrder(id, {
        actor: "ADMIN",
        actorId: admin.id,
        reasonCode: body.reasonCode ?? null,
        reason: body.reason ?? null,
      })
  }
})
