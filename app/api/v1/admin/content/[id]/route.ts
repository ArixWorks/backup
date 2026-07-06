import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { assertCan } from "@/lib/cms/permissions"
import { getContent, updateContent, deleteContent } from "@/lib/cms/content"
import { resolveRelations } from "@/lib/cms/relations"
import { resolveTagIds } from "@/lib/cms/taxonomy"
import { contentWriteSchema } from "@/lib/cms/validation"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export const GET = route(async (_req: Request, ctx: Ctx) => {
  const admin = await requireAdmin()
  const { id } = await ctx.params
  const content = await getContent(id)
  assertCan(admin, content.type, "view")
  const relations = await resolveRelations(id)
  return { content, relations }
})

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const admin = await requireAdmin()
  const { id } = await ctx.params
  const existing = await getContent(id)
  assertCan(admin, existing.type, "update")
  const input = contentWriteSchema.partial({ title: true }).parse(await req.json())
  if (input.tagNames?.length) {
    input.tagIds = [...(input.tagIds ?? []), ...(await resolveTagIds(input.tagNames))]
  }
  return updateContent(admin, id, { title: existing.title, ...input })
})

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const admin = await requireAdmin()
  const { id } = await ctx.params
  const existing = await getContent(id)
  assertCan(admin, existing.type, "delete")
  await deleteContent(id)
  return { ok: true }
})
