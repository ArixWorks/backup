import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { updateCoupon, deleteCoupon } from "@/lib/core/coupons"

export const dynamic = "force-dynamic"

const schema = z.object({
  code: z.string().trim().min(2).max(40).optional(),
  type: z.enum(["PERCENT", "FIXED"]).optional(),
  value: z.number().positive().optional(),
  maxDiscount: z.number().positive().nullish(),
  minOrder: z.number().min(0).optional(),
  perUserLimit: z.number().int().positive().nullish(),
  totalLimit: z.number().int().positive().nullish(),
  active: z.boolean().optional(),
  startsAt: z.string().nullish(),
  expiresAt: z.string().nullish(),
})

export const PATCH = route(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    await requireAdmin()
    const { id } = await ctx.params
    const body = schema.parse(await req.json())
    await updateCoupon(id, body)
    return { ok: true }
  },
)

export const DELETE = route(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    await requireAdmin()
    const { id } = await ctx.params
    await deleteCoupon(id)
    return { ok: true }
  },
)
