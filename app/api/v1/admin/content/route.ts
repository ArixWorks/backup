import type { ContentStatus } from "@prisma/client"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { ValidationError } from "@/lib/core/errors"
import { requireContentType } from "@/lib/cms/registry"
import { assertCan } from "@/lib/cms/permissions"
import { listContent, createContent, getContent, deleteContent } from "@/lib/cms/content"
import { resolveTagIds } from "@/lib/cms/taxonomy"
import { contentWriteSchema } from "@/lib/cms/validation"
import { z } from "zod"

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

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "حداقل یک مورد را انتخاب کنید").max(200),
})

/** Bulk-delete content items. Permission is checked per item by its own type. */
export const DELETE = route(async (req: Request) => {
  const admin = await requireAdmin()
  const { ids } = bulkDeleteSchema.parse(await req.json())
  const unique = Array.from(new Set(ids))
  const deleted: string[] = []
  const skipped: { id: string; title: string; reason: string }[] = []
  for (const id of unique) {
    try {
      const existing = await getContent(id)
      assertCan(admin, existing.type, "delete")
      await deleteContent(id)
      deleted.push(id)
    } catch (e) {
      console.log("[v0] bulk deleteContent error for", id, (e as Error).message)
      skipped.push({ id, title: id, reason: "حذف ممکن نشد یا دسترسی ندارید" })
    }
  }
  return { deleted, skipped }
})
