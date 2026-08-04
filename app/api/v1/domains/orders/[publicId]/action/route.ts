import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { approveDomainExtension, cancelDomainOrderByUser } from "@/lib/core/domains/service"

export const dynamic = "force-dynamic"

// Buyer-side lifecycle actions on a single domain order, addressed by publicId.
// `extend` accepts the admin-requested hold extension; `cancel` rejects it (or
// cancels an awaiting-purchase order) and refunds the frozen principal.
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("extend") }),
  z.object({ action: z.literal("cancel"), reasonCode: z.string().trim().max(60).optional() }),
])

export const POST = route(async (req: Request, ctx: { params: Promise<{ publicId: string }> }) => {
  const user = await requireUser()
  const { publicId } = await ctx.params
  const body = schema.parse(await req.json())
  switch (body.action) {
    case "extend":
      return approveDomainExtension(publicId, user.id)
    case "cancel":
      return cancelDomainOrderByUser(publicId, user.id, body.reasonCode)
  }
})
