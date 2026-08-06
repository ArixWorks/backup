import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { generateVerifiedSuggestions } from "@/lib/core/domains/suggestion-loop"

/** Several generate-then-verify rounds can run per request, so allow headroom. */
export const maxDuration = 60

const inputSchema = z.object({
  prompt: z.string().trim().min(2).max(160),
  extensions: z.array(z.string().regex(/^\.[a-z]{2,15}$/)).max(8).optional(),
})

export const POST = route(async (req: Request) => {
  const user = await requireUser()
  const body = inputSchema.parse(await req.json())
  return generateVerifiedSuggestions({
    prompt: body.prompt,
    extensions: body.extensions,
    userId: user.id,
  })
})
