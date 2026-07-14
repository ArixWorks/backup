import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { runObject } from "@/lib/ai/client"
import { listTlds } from "@/lib/core/domains/service"
import { normalizeLabel } from "@/lib/core/domains/validation"

const inputSchema = z.object({
  prompt: z.string().trim().min(2).max(160),
  extensions: z.array(z.string().regex(/^\.[a-z]{2,15}$/)).max(8).optional(),
})
const outputSchema = z.object({
  suggestions: z.array(z.object({ label: z.string().min(2).max(63), reason: z.string().min(2).max(140) })).min(3).max(8),
})

export const POST = route(async (req: Request) => {
  const user = await requireUser()
  const body = inputSchema.parse(await req.json())
  const supported = (await listTlds()).map((item) => item.tld)
  const extensions = body.extensions?.filter((item) => supported.includes(item)) ?? supported.slice(0, 5)

  let generated: z.infer<typeof outputSchema>
  try {
    const result = await runObject({
      feature: "domains.suggestions",
      userId: user.id,
      tier: "fast",
      temperature: 0.7,
      maxTokens: 600,
      schema: outputSchema,
      system: "You create short, brandable, ASCII domain labels. Return no extension, spaces, trademarked names, or explanations outside the schema.",
      prompt: `Business description (Persian or English): ${body.prompt}\nCreate 6 memorable labels for these extensions: ${extensions.join(", ")}. Reasons must be in Persian.`,
    })
    generated = result.object
  } catch {
    const base = normalizeLabel(body.prompt.replace(/[^a-zA-Z0-9-]/g, "") || "brand")
    generated = {
      suggestions: ["hub", "pro", "online", "market", "plus", "now"].map((suffix) => ({
        label: `${base.slice(0, Math.max(2, 63 - suffix.length))}${suffix}`,
        reason: "نام کوتاه و مناسب برای ساخت یک برند آنلاین",
      })),
    }
  }

  return {
    suggestions: generated.suggestions.flatMap((item) =>
      extensions.slice(0, 3).map((extension) => ({
        domain: `${normalizeLabel(item.label)}${extension}`,
        reason: item.reason,
      })),
    ).slice(0, 12),
  }
})
