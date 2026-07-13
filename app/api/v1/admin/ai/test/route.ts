import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireSuperAdmin } from "@/lib/ai/permissions"
import { testConnection } from "@/lib/ai/test-connection"
import { AI_PROVIDER_IDS } from "@/lib/ai/providers"
import { rateLimitBy } from "@/lib/api/rate-limit"
import { audit } from "@/lib/core/audit"

export const dynamic = "force-dynamic"

const schema = z.object({
  provider: z.enum(AI_PROVIDER_IDS as [string, ...string[]]),
  model: z.string().trim().min(1).max(200).optional(),
  capability: z.enum(["connection", "text", "image", "embedding"]).default("connection"),
})

export const POST = route(async (req: Request) => {
  const admin = await requireSuperAdmin()
  const body = schema.parse(await req.json())
  // Test calls hit a real model — keep them modestly rate limited.
  await rateLimitBy(admin.id, { bucket: "ai:test", limit: 10, windowSec: 60 })
  const result = await testConnection(body.provider, body.model, body.capability)
  await audit({
    actorId: admin.id,
    action: "ai.credential.test",
    entity: "AiCredential",
    entityId: body.provider,
    meta: { status: result.status, capability: body.capability, model: body.model },
  })
  return result
})
