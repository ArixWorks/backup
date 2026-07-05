import "server-only"
import { route } from "@/lib/api/handler"
import { requireAiAdmin } from "@/lib/ai/permissions"
import { audit } from "@/lib/core/audit"
import { executeAutomation, getHandler } from "@/lib/ai/automations"
import { NotFoundError } from "@/lib/core/errors"

// Manually trigger an automation now (regardless of schedule). Useful for
// testing and for on-demand digests. Still records a run + respects guardrails.
export const POST = route(async (_req: Request, ctx: { params: Promise<{ key: string }> }) => {
  const admin = await requireAiAdmin()
  const { key } = await ctx.params
  if (!getHandler(key)) throw new NotFoundError("اتوماسیون یافت نشد")
  const result = await executeAutomation(key)
  await audit({
    actorId: admin.id,
    action: "ai.automation.run",
    entity: "AiAutomation",
    entityId: key,
  })
  return result
})
