import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { markWinnerDelivered } from "@/lib/core/giveaway"

const deliverySchema = z
  .object({
    username: z.string().trim().max(500).optional(),
    password: z.string().trim().max(500).optional(),
    licenseKey: z.string().trim().max(2000).optional(),
    note: z.string().trim().max(10_000).optional(),
  })
  .refine((value) => Object.values(value).some(Boolean), {
    message: "حداقل یک فیلد تحویل را پر کنید",
  })

export const POST = route(
  async (
    req: Request,
    ctx: { params: Promise<{ id: string; winnerId: string }> },
  ) => {
    const admin = await requireAdmin()
    const { id, winnerId } = await ctx.params
    const payload = deliverySchema.parse(await req.json())
    const winner = await markWinnerDelivered(id, winnerId, payload, admin.id)
    return { id: winner.id, delivered: winner.delivered, deliveredAt: winner.deliveredAt }
  },
)
