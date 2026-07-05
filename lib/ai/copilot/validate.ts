import "server-only"
import { z } from "zod"
import { runObject } from "../client"
import { getEntityDef } from "./entities"
import type { ValidationResult } from "./types"

/**
 * Pre-save AI validation. Reviews the (possibly admin-edited) form for quality:
 * title strength, description completeness, SEO presence, price sanity vs the
 * category, taxonomy, image coverage and overall completeness. Returns a
 * structured report with an optional one-click `suggestedFix` per issue.
 */

const validationSchema = z.object({
  items: z.array(
    z.object({
      field: z.string().describe("کلید فیلد مرتبط"),
      label: z.string().describe("عنوان فارسی فیلد"),
      status: z.enum(["ok", "warn", "error"]),
      message: z.string().describe("توضیح کوتاه مشکل یا تأیید"),
      // Nullable (not optional): strict structured-output mode requires every
      // key to be present; the model returns null when there is no fix.
      suggestedFix: z.string().nullable().describe("مقدار پیشنهادی قابل‌اعمال، در صورت وجود"),
    }),
  ),
  overall: z.enum(["ok", "warn", "error"]),
})

export interface ValidateInput {
  entityId: string
  form: Record<string, unknown>
  context?: { similarItems?: { title: string; price?: number | null }[] }
  userId?: string | null
}

export async function validateForm(input: ValidateInput): Promise<ValidationResult> {
  const def = getEntityDef(input.entityId)
  if (!def) throw new Error(`Unknown copilot entity: ${input.entityId}`)

  const prompt = [
    `این فرم «${def.label}» را پیش از ذخیره بررسی کیفی کن.`,
    "برای هر معیار مهم یک آیتم بساز: عنوان، توضیحات، سئو، قیمت (منطقی بودن)، دسته‌بندی، کامل بودن تصاویر و کامل بودن کلی.",
    "اگر مشکلی هست status را warn یا error بگذار و در صورت امکان suggestedFix قابل‌اعمال بده.",
    input.context?.similarItems?.length
      ? `\nمحصولات مشابه (برای سنجش قیمت):\n${input.context.similarItems
          .map((s) => `- ${s.title}${s.price ? ` — ${s.price} تومان` : ""}`)
          .join("\n")}`
      : "",
    `\nفرم فعلی (JSON):\n${JSON.stringify(input.form)}`,
  ]
    .filter(Boolean)
    .join("\n")

  const { object } = await runObject({
    feature: `copilot.${def.id}.validate`,
    schema: validationSchema,
    system: def.systemPrompt,
    userId: input.userId,
    prompt,
    refType: "copilot",
    refId: def.id,
    tier: "fast",
  })
  return object as ValidationResult
}
