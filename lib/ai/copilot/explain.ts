import "server-only"
import { runText } from "../client"
import { getEntityDef } from "./entities"

/**
 * On-demand "Explain Decision" — a deeper rationale for an important AI
 * suggestion (price, category, sale type, image, SEO) when the admin clicks
 * "why?". Most reasons ship inline with the autofill output; this is the
 * fallback for a fuller explanation. Uses the fast tier to stay snappy.
 */
export async function explainDecision(input: {
  entityId: string
  field: string
  value: unknown
  form?: Record<string, unknown>
  userId?: string | null
}): Promise<string> {
  const def = getEntityDef(input.entityId)
  if (!def) throw new Error(`Unknown copilot entity: ${input.entityId}`)
  const fieldDef = def.fields.find((f) => f.key === input.field)
  const label = fieldDef?.label ?? input.field

  const { text } = await runText({
    feature: `copilot.${def.id}.explain`,
    system: def.systemPrompt,
    userId: input.userId,
    tier: "fast",
    refType: "copilot",
    refId: def.id,
    prompt: [
      `در حداکثر ۳ جمله توضیح بده چرا این مقدار برای فیلد «${label}» پیشنهاد شده است.`,
      `مقدار پیشنهادی: ${JSON.stringify(input.value)}`,
      input.form ? `\nزمینه‌ی فرم (JSON):\n${JSON.stringify(input.form)}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  })
  return text.trim()
}
