import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { createProductCategory, listCategoriesAdmin } from "@/lib/core/product-categories"

export const dynamic = "force-dynamic"

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "شناسه باید انگلیسی و خط‌تیره‌دار باشد"),
  description: z.string().trim().max(240).nullable().optional(),
  icon: z.string().trim().max(40).nullable().optional(),
  displayOrder: z.number().int().min(0).max(10000).optional(),
  active: z.boolean().optional(),
})

export const GET = route(async () => {
  await requireAdmin()
  return listCategoriesAdmin()
})

export const POST = route(async (req: Request) => {
  const admin = await requireAdmin()
  return createProductCategory(schema.parse(await req.json()), admin.id)
})
