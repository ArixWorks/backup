import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAiAdmin } from "@/lib/ai/permissions"
import {
  generateAnnouncement,
  generateProductDescription,
  generateSeo,
  rewriteText,
  runInlineAction,
  suggestTaxonomy,
  translateText,
} from "@/lib/ai/content"

export const dynamic = "force-dynamic"

// Single content-generation endpoint. `task` selects the generator; each task
// validates its own payload. Every generator routes through the shared AI core.
const schema = z.discriminatedUnion("task", [
  z.object({
    task: z.literal("product_description"),
    title: z.string().min(2),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    notes: z.string().optional(),
    tone: z.string().optional(),
    locale: z.string().optional(),
  }),
  z.object({
    task: z.literal("seo"),
    title: z.string().min(2),
    description: z.string().optional(),
    locale: z.string().optional(),
  }),
  z.object({
    task: z.literal("taxonomy"),
    title: z.string().min(2),
    description: z.string().optional(),
    existingCategories: z.array(z.string()).optional(),
  }),
  z.object({
    task: z.literal("translate"),
    text: z.string().min(1),
    targetLocale: z.string().min(2),
  }),
  z.object({
    task: z.literal("rewrite"),
    text: z.string().min(1),
    instruction: z.string().optional(),
    tone: z.string().optional(),
    locale: z.string().optional(),
  }),
  z.object({
    task: z.literal("announcement"),
    topic: z.string().min(2),
    points: z.string().optional(),
    channel: z.string().optional(),
    tone: z.string().optional(),
    locale: z.string().optional(),
  }),
  z.object({
    task: z.literal("inline"),
    action: z.enum(["rewrite", "expand", "shorten", "improve", "translate", "seo", "grammar"]),
    html: z.string().min(1),
    targetLocale: z.string().optional(),
    locale: z.string().optional(),
  }),
])

export const POST = route(async (req: Request) => {
  const admin = await requireAiAdmin()
  const body = schema.parse(await req.json())
  const actor = { userId: admin.id }

  switch (body.task) {
    case "product_description":
      return generateProductDescription(body, actor)
    case "seo":
      return generateSeo(body, actor)
    case "taxonomy":
      return suggestTaxonomy(body, actor)
    case "translate":
      return translateText(body, actor)
    case "rewrite":
      return rewriteText(body, actor)
    case "announcement":
      return generateAnnouncement(body, actor)
    case "inline":
      return runInlineAction(body, actor)
  }
})
