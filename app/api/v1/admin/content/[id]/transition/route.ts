import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { assertCan } from "@/lib/cms/permissions"
import { getContent, transitionStatus } from "@/lib/cms/content"
import { transitionSchema } from "@/lib/cms/validation"

export const dynamic = "force-dynamic"

/** Publish / schedule / unpublish (draft) / archive a content item. */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  const { id } = await ctx.params
  const existing = await getContent(id)
  assertCan(admin, existing.type, "publish")
  const { status, scheduledFor } = transitionSchema.parse(await req.json())
  return transitionStatus(admin, id, status, scheduledFor)
})
