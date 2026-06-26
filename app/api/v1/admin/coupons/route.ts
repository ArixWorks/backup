import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { listCoupons, createCoupon } from "@/lib/core/coupons"

export const dynamic = "force-dynamic"

const schema = z.object({
  code: z.string().trim().min(2).max(40),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.number().positive(),
  maxDiscount: z.number().positive().nullish(),
  minOrder: z.number().min(0).optional(),
  perUserLimit: z.number().int().positive().nullish(),
  totalLimit: z.number().int().positive().nullish(),
  active: z.boolean().optional(),
  startsAt: z.string().nullish(),
  expiresAt: z.string().nullish(),
})

export const GET = route(async () => {
  await requireAdmin()
  const coupons = await listCoupons()
  return coupons.map((c) => ({
    ...c,
    value: c.value.toString(),
    maxDiscount: c.maxDiscount?.toString() ?? null,
    minOrder: c.minOrder.toString(),
  }))
})

export const POST = route(async (req: Request) => {
  await requireAdmin()
  const body = schema.parse(await req.json())
  const created = await createCoupon(body)
  return { id: created.id }
})
