import type { ContentStatus } from "@prisma/client"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { ValidationError } from "@/lib/core/errors"
import { requireContentType } from "@/lib/cms/registry"
import { assertCan } from "@/lib/cms/permissions"
import { listContent, createContent } from "@/lib/cms/content"
import { resolveTagIds } from "@/lib/cms/taxonomy"
import { contentWriteSchema } from "@/lib/cms/validation"

export const dynamic = "force-dynamic"

/** List content of a type (admin). Filter by status, category, search, page. */
export const GET = route(async (req: Request) => {
  const admin = await requireAdmin()
  const url = new URL(req.url)
  const type = url.searchParams.get("type")
  if (!type) throw new ValidationError("نوع محتوا الزامی است")
  assertCan(admin, type, "view")
  const status = url.searchParams.get("status") as ContentStatus | null
  return listContent({
    type,
    status: status ?? undefined,
    categoryId: url.searchParams.get("categoryId") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    page: Number(url.searchParams.get("page") ?? "1"),
    pageSize: Number(url.searchParams.get("pageSize") ?? "20"),
  })
})

/** Create a content item of a type. */
export const POST = route(async (req: Request) => {
  const admin = await requireAdmin()
  const url = new URL(req.url)
  const type = url.searchParams.get("type")
  if (!type) throw new ValidationError("نوع محتوا الزامی است")
  requireContentType(type)
  assertCan(admin, type, "create")
  const input = contentWriteSchema.parse(await req.json())
  if (input.tagNames?.length) {
    input.tagIds = [...(input.tagIds ?? []), ...(await resolveTagIds(input.tagNames))]
  }
  return createContent(admin, type, input)
})
