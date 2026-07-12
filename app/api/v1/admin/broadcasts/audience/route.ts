import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { audienceSchema, previewAudience } from "@/lib/broadcast/core"

export const dynamic = "force-dynamic"

export const POST = route(async (req: Request) => {
  await requireAdmin()
  return previewAudience(audienceSchema.parse(await req.json()))
})
