import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireSuperAdmin } from "@/lib/ai/permissions"
import { deleteApiKey, listMaskedCredentials, setApiKey } from "@/lib/ai/credentials"
import { AI_PROVIDER_IDS } from "@/lib/ai/providers"
import { audit } from "@/lib/core/audit"

export const dynamic = "force-dynamic"

// Secret API keys — Super Admin only. Raw keys are never returned; only masked
// hints and connection status.
export const GET = route(async () => {
  await requireSuperAdmin()
  return listMaskedCredentials()
})

const putSchema = z.object({
  provider: z.enum(AI_PROVIDER_IDS as [string, ...string[]]),
  apiKey: z.string().min(8, "کلید API نامعتبر است"),
  label: z.string().max(80).optional(),
})

export const PUT = route(async (req: Request) => {
  const admin = await requireSuperAdmin()
  const body = putSchema.parse(await req.json())
  await setApiKey(body.provider, body.apiKey.trim(), admin.id, body.label)
  await audit({
    actorId: admin.id,
    action: "ai.credential.set",
    entity: "AiCredential",
    entityId: body.provider,
  })
  return { ok: true }
})

const delSchema = z.object({ provider: z.enum(AI_PROVIDER_IDS as [string, ...string[]]) })

export const DELETE = route(async (req: Request) => {
  const admin = await requireSuperAdmin()
  const body = delSchema.parse(await req.json())
  await deleteApiKey(body.provider)
  await audit({
    actorId: admin.id,
    action: "ai.credential.delete",
    entity: "AiCredential",
    entityId: body.provider,
  })
  return { ok: true }
})
