import "server-only"
import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAiAdmin } from "@/lib/ai/permissions"
import { audit } from "@/lib/core/audit"
import { listAutomations, listRecentRuns, updateAutomation } from "@/lib/ai/automations"

export const GET = route(async () => {
  await requireAiAdmin()
  const [automations, recentRuns] = await Promise.all([listAutomations(), listRecentRuns(20)])
  return { automations, recentRuns }
})

const patchSchema = z.object({
  key: z.string().min(1),
  enabled: z.boolean().optional(),
  intervalMin: z.number().int().min(15).max(43200).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
})

export const PATCH = route(async (req: Request) => {
  const admin = await requireAiAdmin()
  const body = patchSchema.parse(await req.json())
  const updated = await updateAutomation(body.key, {
    enabled: body.enabled,
    intervalMin: body.intervalMin,
    config: body.config,
  })
  await audit({
    actorId: admin.id,
    action: "ai.automation.update",
    entity: "AiAutomation",
    entityId: body.key,
  })
  return updated
})
