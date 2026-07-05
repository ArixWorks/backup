import "server-only"
import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAiAdmin } from "@/lib/ai/permissions"
import { audit } from "@/lib/core/audit"
import { NotFoundError } from "@/lib/core/errors"
import { deleteDoc, getDoc, ingestDoc, updateDoc } from "@/lib/ai/knowledge"

export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAiAdmin()
  const { id } = await ctx.params
  const doc = await getDoc(id)
  if (!doc) throw new NotFoundError("سند یافت نشد")
  return doc
})

const patchSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  content: z.string().trim().min(10).max(50_000).optional(),
  category: z.string().trim().max(80).nullable().optional(),
  sourceUrl: z.string().trim().url().max(500).nullable().optional().or(z.literal("")),
  locale: z.string().trim().max(10).optional(),
  isPublic: z.boolean().optional(),
  // When true, force a re-embed even if content is unchanged.
  reindex: z.boolean().optional(),
})

export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAiAdmin()
  const { id } = await ctx.params
  const body = patchSchema.parse(await req.json())

  const doc = await updateDoc(
    id,
    {
      title: body.title,
      content: body.content,
      category: body.category,
      sourceUrl: body.sourceUrl === "" ? null : body.sourceUrl,
      locale: body.locale,
      isPublic: body.isPublic,
    },
    admin.id,
  )

  if (body.reindex) await ingestDoc(id, admin.id)

  await audit({
    actorId: admin.id,
    action: "ai.knowledge.update",
    entity: "AiKnowledgeDoc",
    entityId: id,
  })
  return getDoc(id)
})

export const DELETE = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAiAdmin()
  const { id } = await ctx.params
  await deleteDoc(id)
  await audit({
    actorId: admin.id,
    action: "ai.knowledge.delete",
    entity: "AiKnowledgeDoc",
    entityId: id,
  })
  return { ok: true }
})
