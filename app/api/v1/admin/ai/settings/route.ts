import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAiAdmin } from "@/lib/ai/permissions"
import { getAiSettingsForAdmin, saveAiSettings } from "@/lib/ai/settings"
import {
  getImageSettingsForAdmin,
  saveImageSettings,
} from "@/lib/ai/image/settings"
import { AI_PROVIDERS } from "@/lib/ai/providers"
import { audit } from "@/lib/core/audit"

export const dynamic = "force-dynamic"

// Non-secret AI configuration. Any admin may view/edit these; secret keys are a
// separate, Super-Admin-only endpoint.
export const GET = route(async () => {
  await requireAiAdmin()
  const [textSettings, imageSettings] = await Promise.all([
    getAiSettingsForAdmin(),
    getImageSettingsForAdmin(),
  ])
  return {
    values: { ...textSettings.values, ...imageSettings.values },
    source: { ...textSettings.source, ...imageSettings.source },
    providers: AI_PROVIDERS,
  }
})

const schema = z.record(z.string(), z.string())

export const PATCH = route(async (req: Request) => {
  const admin = await requireAiAdmin()
  const body = schema.parse(await req.json())
  await Promise.all([saveAiSettings(body), saveImageSettings(body)])
  await audit({ actorId: admin.id, action: "ai.settings.update", entity: "AiSettings", meta: { keys: Object.keys(body) } })
  return { ok: true }
})
