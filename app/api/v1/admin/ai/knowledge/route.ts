import "server-only"
import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAiAdmin } from "@/lib/ai/permissions"
import { audit } from "@/lib/core/audit"
import { createDoc, listDocs } from "@/lib/ai/knowledge"

export const GET = route(async () => {
  await requireAiAdmin()
  const docs = await listDocs()
  return docs
})

const createSchema = z.object({
  title: z.string().trim().min(2, "عنوان الزامی است").max(200),
  content: z.string().trim().min(10, "متن باید حداقل ۱۰ کاراکتر باشد").max(50_000),
  category: z.string().trim().max(80).optional(),
  sourceUrl: z.string().trim().url("آدرس نامعتبر است").max(500).optional().or(z.literal("")),
  locale: z.string().trim().max(10).optional(),
  isPublic: z.boolean().optional(),
})

export const POST = route(async (req: Request) => {
  const admin = await requireAiAdmin()
  const body = createSchema.parse(await req.json())
  const doc = await createDoc({
    title: body.title,
    content: body.content,
    category: body.category || null,
    sourceUrl: body.sourceUrl || null,
    locale: body.locale,
    isPublic: body.isPublic ?? true,
    createdById: admin.id,
  })
  await audit({
    actorId: admin.id,
    action: "ai.knowledge.create",
    entity: "AiKnowledgeDoc",
    entityId: doc?.id ?? "",
  })
  return doc
})
