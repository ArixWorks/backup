import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { ValidationError } from "@/lib/core/errors"
import { assertCan } from "@/lib/cms/permissions"
import { listCategories, createCategory } from "@/lib/cms/taxonomy"
import { categoryWriteSchema } from "@/lib/cms/validation"

export const dynamic = "force-dynamic"

export const GET = route(async (req: Request) => {
  const admin = await requireAdmin()
  const type = new URL(req.url).searchParams.get("type")
  if (!type) throw new ValidationError("نوع محتوا الزامی است")
  assertCan(admin, type, "view")
  return { items: await listCategories(type) }
})

export const POST = route(async (req: Request) => {
  const admin = await requireAdmin()
  const input = categoryWriteSchema.parse(await req.json())
  assertCan(admin, input.type, "update")
  return createCategory(input)
})
