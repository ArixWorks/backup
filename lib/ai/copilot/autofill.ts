import "server-only"
import { z } from "zod"
import { runObject } from "../client"
import {
  getEntityDef,
  LOCALE_LABEL,
  SUPPORTED_LOCALES,
  type CopilotEntityDef,
  type CopilotFieldDef,
} from "./entities"
import type { CopilotApplyMode, CopilotFormObject } from "./types"
import { getStyleHints } from "./feedback"

/**
 * Form Autofill engine. Turns a short admin brief into a complete, structured
 * "Form Object" for a given entity — every field (native in fa/en/ru/hi),
 * pricing, taxonomy, SEO, image prompts and a recommended sale type — in ONE
 * provider-agnostic `runObject` call. The output is applied directly to the
 * form; nothing is text the admin has to copy/paste.
 */

export interface AutofillContext {
  /** Current form values (for fill-missing / patch / improve). */
  currentForm?: Record<string, unknown>
  /** Only these keys should be (re)generated (patch mode). */
  targetFields?: string[]
  /** Existing categories to prefer for taxonomy. */
  existingCategories?: string[]
  /** Similar catalog items, so the model avoids duplicates + prices sanely. */
  similarItems?: { title: string; category?: string | null; price?: number | null }[]
}

const LOCALE_VALUE_SHAPE = z.object(
  Object.fromEntries(SUPPORTED_LOCALES.map((l) => [l, z.string()])) as Record<
    (typeof SUPPORTED_LOCALES)[number],
    z.ZodString
  >,
)

const SEO_LOCALE_SHAPE = z.object(
  Object.fromEntries(
    SUPPORTED_LOCALES.map((l) => [
      l,
      z.object({
        metaTitle: z.string(),
        metaDescription: z.string(),
        keywords: z.array(z.string()),
      }),
    ]),
  ) as Record<(typeof SUPPORTED_LOCALES)[number], z.ZodTypeAny>,
)

/** Build the per-field value schema (value + optional reason) for one field. */
function fieldValueSchema(field: CopilotFieldDef): z.ZodTypeAny {
  let value: z.ZodTypeAny
  if (field.type === "seo") {
    value = field.localized ? SEO_LOCALE_SHAPE : z.object({
      metaTitle: z.string(),
      metaDescription: z.string(),
      keywords: z.array(z.string()),
    })
  } else if (field.type === "tags") {
    value = z.array(z.string())
  } else if (field.type === "number" || field.type === "money") {
    value = z.number()
  } else if (field.localized) {
    value = LOCALE_VALUE_SHAPE
  } else {
    value = z.string()
  }
  const shape: Record<string, z.ZodTypeAny> = { value }
  if (field.explainable) shape.reason = z.string().describe("دلیل کوتاه این پیشنهاد (حداکثر ۲ جمله)")
  return z.object(shape)
}

/** Build the full Form Object schema for an entity, honoring the field subset. */
function buildSchema(def: CopilotEntityDef, onlyKeys?: string[]) {
  const fieldEntries = def.fields
    .filter((f) => f.aiFillable !== false)
    .filter((f) => !onlyKeys || onlyKeys.includes(f.key))
    .map((f) => [f.key, fieldValueSchema(f).optional()] as const)

  const shape: Record<string, z.ZodTypeAny> = {
    fields: z.object(Object.fromEntries(fieldEntries)),
    summary: z.string().describe("خلاصه‌ی یک‌جمله‌ای از آنچه تولید شد"),
  }
  if (def.imageSlots.length > 0) {
    shape.imagePrompts = z
      .object(Object.fromEntries(def.imageSlots.map((s) => [s.key, z.string()])))
      .partial()
      .describe("پرامپت پیشنهادی برای هر تصویر (به انگلیسی برای کیفیت بهتر)")
  }
  if (def.recommendSaleType) {
    shape.recommendedSaleType = z.object({
      value: z.enum(["FIXED_PRICE", "AUCTION", "GIVEAWAY"]),
      reason: z.string().describe("چرا این نوع فروش برای این محصول بهتر است"),
    })
  }
  return z.object(shape)
}

function localeList(): string {
  return SUPPORTED_LOCALES.map((l) => `${l} (${LOCALE_LABEL[l]})`).join("، ")
}

function fieldGuide(def: CopilotEntityDef, onlyKeys?: string[]): string {
  return def.fields
    .filter((f) => f.aiFillable !== false)
    .filter((f) => !onlyKeys || onlyKeys.includes(f.key))
    .map((f) => {
      const loc = f.localized ? " [چندزبانه]" : ""
      const hint = f.hint ? ` — ${f.hint}` : ""
      return `• ${f.key} (${f.label})${loc}${hint}`
    })
    .join("\n")
}

function contextBlock(def: CopilotEntityDef, ctx: AutofillContext, styleHints: string): string {
  const parts: string[] = []
  if (ctx.existingCategories?.length) {
    parts.push(`دسته‌های موجود (در صورت تناسب یکی را انتخاب کن): ${ctx.existingCategories.join("، ")}`)
  }
  if (ctx.similarItems?.length) {
    parts.push(
      "محصولات مشابه موجود (برای جلوگیری از تکرار و قیمت‌گذاری منطقی):\n" +
        ctx.similarItems
          .map((s) => `- ${s.title}${s.category ? ` [${s.category}]` : ""}${s.price ? ` — ${s.price} تومان` : ""}`)
          .join("\n"),
    )
  }
  if (styleHints) parts.push(`راهنمای سبک بر اساس اصلاحات قبلی مدیر:\n${styleHints}`)
  return parts.length ? `\n\nاطلاعات زمینه:\n${parts.join("\n\n")}` : ""
}

const MODE_INSTRUCTION: Record<CopilotApplyMode, string> = {
  "fill-missing": "فقط فیلدهایی که در «فرم فعلی» خالی هستند را تولید کن و بقیه را دست‌نخورده رها کن.",
  patch: "فقط فیلدهای درخواست‌شده را تولید کن.",
  replace: "تمام فیلدهای فرم را از نو و کامل تولید کن.",
}

export interface RunAutofillInput {
  entityId: string
  brief: string
  mode: CopilotApplyMode
  context?: AutofillContext
  userId?: string | null
}

/** Generate a full Form Object for an entity in one structured call. */
export async function generateFormObject(input: RunAutofillInput): Promise<CopilotFormObject> {
  const def = getEntityDef(input.entityId)
  if (!def) throw new Error(`Unknown copilot entity: ${input.entityId}`)
  const ctx = input.context ?? {}
  const onlyKeys = input.mode === "patch" ? ctx.targetFields : undefined
  const schema = buildSchema(def, onlyKeys)
  const styleHints = await getStyleHints(input.entityId)

  const prompt = [
    `درخواست مدیر: ${input.brief}`,
    "",
    `فیلدهایی که باید تولید شوند:`,
    fieldGuide(def, onlyKeys),
    "",
    `فیلدهای چندزبانه را برای هر زبان به‌صورت Native و بومی‌سازی‌شده تولید کن (نه ترجمه‌ی لفظی). زبان‌ها: ${localeList()}.`,
    `اگر ترجمه‌ی مستقیم کیفیت خوبی ندارد، متن آن زبان را بازنویسی فرهنگی کن.`,
    MODE_INSTRUCTION[input.mode],
    input.mode !== "replace" && ctx.currentForm
      ? `\nفرم فعلی (JSON):\n${JSON.stringify(ctx.currentForm)}`
      : "",
    def.recommendSaleType
      ? "\nبر اساس ماهیت محصول، بهترین نوع فروش (فروشگاهی/مزایده/قرعه‌کشی) و قیمت منطقی را پیشنهاد بده."
      : "",
    contextBlock(def, ctx, styleHints),
  ]
    .filter(Boolean)
    .join("\n")

  const { object } = await runObject({
    feature: `copilot.${def.id}.autofill`,
    schema,
    system: def.systemPrompt,
    userId: input.userId,
    prompt,
    refType: "copilot",
    refId: def.id,
  })
  return object as CopilotFormObject
}

/**
 * "Improve with AI" — analyze existing form data and enhance it (better titles,
 * fuller descriptions, stronger SEO, fill gaps, sane pricing). Same output shape
 * so it flows through the same preview/diff path.
 */
export async function improveFormObject(input: RunAutofillInput): Promise<CopilotFormObject> {
  const def = getEntityDef(input.entityId)
  if (!def) throw new Error(`Unknown copilot entity: ${input.entityId}`)
  const ctx = input.context ?? {}
  const schema = buildSchema(def)
  const styleHints = await getStyleHints(input.entityId)

  const prompt = [
    "این موجودیت از قبل وجود دارد. داده‌ی فعلی را تحلیل کن و آن را بهبود بده:",
    "- عنوان‌ها را جذاب‌تر و دقیق‌تر کن.",
    "- توضیحات را کامل‌تر و متقاعدکننده‌تر کن.",
    "- سئو و متادیتا را بهینه کن.",
    "- فیلدهای ناقص یا خالی را پر کن.",
    "- در صورت لزوم قیمت/دسته را اصلاح کن و دلیلش را بگو.",
    input.brief ? `\nراهنمای اضافی مدیر: ${input.brief}` : "",
    `\nفیلدهای چندزبانه را برای همه‌ی زبان‌ها Native نگه‌دار. زبان‌ها: ${localeList()}.`,
    `\nفرم فعلی (JSON):\n${JSON.stringify(ctx.currentForm ?? {})}`,
    contextBlock(def, ctx, styleHints),
  ]
    .filter(Boolean)
    .join("\n")

  const { object } = await runObject({
    feature: `copilot.${def.id}.improve`,
    schema,
    system: def.systemPrompt,
    userId: input.userId,
    prompt,
    refType: "copilot",
    refId: def.id,
  })
  return object as CopilotFormObject
}

/** Regenerate a single field (optionally a single locale) without touching others. */
export async function regenerateField(input: {
  entityId: string
  field: string
  locale?: string
  currentForm?: Record<string, unknown>
  brief?: string
  userId?: string | null
}): Promise<CopilotFormObject> {
  const def = getEntityDef(input.entityId)
  if (!def) throw new Error(`Unknown copilot entity: ${input.entityId}`)
  const fieldDef = def.fields.find((f) => f.key === input.field)
  if (!fieldDef) throw new Error(`Unknown field: ${input.field}`)

  // Reuse buildSchema restricted to the single field.
  const schema = buildSchema(def, [input.field])
  const prompt = [
    `فقط فیلد «${fieldDef.label}» (${fieldDef.key}) را دوباره و بهتر تولید کن.`,
    input.locale ? `فقط برای زبان ${input.locale}.` : fieldDef.localized ? `برای همه‌ی زبان‌ها: ${localeList()}.` : "",
    input.brief ? `راهنما: ${input.brief}` : "",
    input.currentForm ? `\nفرم فعلی (JSON):\n${JSON.stringify(input.currentForm)}` : "",
  ]
    .filter(Boolean)
    .join("\n")

  const { object } = await runObject({
    feature: `copilot.${def.id}.field`,
    schema,
    system: def.systemPrompt,
    userId: input.userId,
    prompt,
    refType: "copilot",
    refId: def.id,
  })
  return object as CopilotFormObject
}
