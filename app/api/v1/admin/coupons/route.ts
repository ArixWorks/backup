import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { listCoupons, createCoupon, deleteCoupon } from "@/lib/core/coupons"

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

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "حداقل یک مورد را انتخاب کنید").max(200),
})

export const DELETE = route(async (req: Request) => {
  await requireAdmin()
  const { ids } = bulkDeleteSchema.parse(await req.json())
  const unique = Array.from(new Set(ids))
  const deleted: string[] = []
  const skipped: { id: string; title: string; reason: string }[] = []
  for (const id of unique) {
    try {
      await deleteCoupon(id)
      deleted.push(id)
    } catch (e) {
      console.log("[v0] bulk deleteCoupon error for", id, (e as Error).message)
      skipped.push({ id, title: id, reason: "حذف ممکن نشد" })
    }
  }
  return { deleted, skipped }
})
