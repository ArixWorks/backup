import "server-only"
import { z } from "zod"
import { runObject } from "./client"

/**
 * AI Content Studio — all content-generation tasks funnel through the shared AI
 * core (`runObject`). Every task is structured (Zod-validated) so the UI gets
 * predictable fields and nothing is bound to a specific provider/model.
 *
 * Feature tags are namespaced `content.*` for analytics + rate scoping.
 */

const LOCALE_LABEL: Record<string, string> = {
  fa: "فارسی",
  en: "English",
  ru: "Русский",
  hi: "हिन्दी",
  ar: "العربية",
  tr: "Türkçe",
}

const TONE_LABEL: Record<string, string> = {
  professional: "حرفه‌ای و رسمی",
  friendly: "صمیمی و دوستانه",
  persuasive: "متقاعدکننده و فروش‌محور",
  playful: "شوخ و جذاب",
  concise: "کوتاه و مستقیم",
}

function toneHint(tone?: string) {
  return tone && TONE_LABEL[tone] ? `لحن نوشته: ${TONE_LABEL[tone]}.` : ""
}

const BASE_SYSTEM =
  "تو نویسنده ارشد محتوای یک فروشگاه محصولات دیجیتال فارسی‌زبان (SubIO) هستی. " +
  "خروجی باید طبیعی، بدون اغراق غیرواقعی، سئو-دوست و کاملاً به زبان درخواستی باشد. " +
  "هرگز اطلاعات ساختگی درباره قیمت یا موجودی نساز."

export interface ContentActor {
  userId?: string | null
}

// ---------------------------------------------------------------------------
// Task: product description
// ---------------------------------------------------------------------------
export const productDescriptionSchema = z.object({
  shortDescription: z.string().describe("یک جمله جذاب حداکثر ۱۲۰ کاراکتر"),
  description: z.string().describe("توضیح کامل ۲ تا ۴ پاراگراف با فرمت متن ساده"),
  bullets: z.array(z.string()).min(3).max(6).describe("۳ تا ۶ ویژگی کلیدی"),
})
export type ProductDescription = z.infer<typeof productDescriptionSchema>

export async function generateProductDescription(
  input: { title: string; category?: string; tags?: string[]; notes?: string; tone?: string; locale?: string },
  actor: ContentActor,
): Promise<ProductDescription> {
  const locale = LOCALE_LABEL[input.locale ?? "fa"] ?? "فارسی"
  const { object } = await runObject({
    feature: "content.product_description",
    schema: productDescriptionSchema,
    system: BASE_SYSTEM,
    userId: actor.userId,
    prompt: [
      `برای این محصول یک توضیح فروشگاهی به زبان ${locale} بنویس.`,
      `عنوان: ${input.title}`,
      input.category ? `دسته‌بندی: ${input.category}` : "",
      input.tags?.length ? `برچسب‌ها: ${input.tags.join("، ")}` : "",
      input.notes ? `نکات مهم: ${input.notes}` : "",
      toneHint(input.tone),
    ]
      .filter(Boolean)
      .join("\n"),
  })
  return object
}

// ---------------------------------------------------------------------------
// Task: SEO meta
// ---------------------------------------------------------------------------
export const seoSchema = z.object({
  metaTitle: z.string().describe("عنوان سئو حداکثر ۶۰ کاراکتر"),
  metaDescription: z.string().describe("توضیح متا ۱۲۰ تا ۱۶۰ کاراکتر"),
  keywords: z.array(z.string()).min(4).max(12).describe("کلمات کلیدی مرتبط"),
})
export type SeoContent = z.infer<typeof seoSchema>

export async function generateSeo(
  input: { title: string; description?: string; locale?: string },
  actor: ContentActor,
): Promise<SeoContent> {
  const locale = LOCALE_LABEL[input.locale ?? "fa"] ?? "فارسی"
  const { object } = await runObject({
    feature: "content.seo",
    schema: seoSchema,
    system: BASE_SYSTEM,
    userId: actor.userId,
    prompt: [
      `متادیتای سئو به زبان ${locale} برای این محصول تولید کن.`,
      `عنوان: ${input.title}`,
      input.description ? `توضیح: ${input.description}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  })
  return object
}

// ---------------------------------------------------------------------------
// Task: category + tags suggestion
// ---------------------------------------------------------------------------
export const taxonomySchema = z.object({
  category: z.string().describe("مناسب‌ترین دسته‌بندی واحد"),
  tags: z.array(z.string()).min(3).max(10).describe("برچسب‌های مرتبط"),
})
export type Taxonomy = z.infer<typeof taxonomySchema>

export async function suggestTaxonomy(
  input: { title: string; description?: string; existingCategories?: string[] },
  actor: ContentActor,
): Promise<Taxonomy> {
  const { object } = await runObject({
    feature: "content.taxonomy",
    schema: taxonomySchema,
    system: BASE_SYSTEM,
    userId: actor.userId,
    prompt: [
      "برای این محصول یک دسته‌بندی و مجموعه‌ای از برچسب‌های فارسی پیشنهاد بده.",
      `عنوان: ${input.title}`,
      input.description ? `توضیح: ${input.description}` : "",
      input.existingCategories?.length
        ? `در صورت تناسب یکی از این دسته‌های موجود را انتخاب کن: ${input.existingCategories.join("، ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  })
  return object
}

// ---------------------------------------------------------------------------
// Task: translate
// ---------------------------------------------------------------------------
export const textSchema = z.object({ text: z.string() })

export async function translateText(
  input: { text: string; targetLocale: string },
  actor: ContentActor,
): Promise<{ text: string }> {
  const target = LOCALE_LABEL[input.targetLocale] ?? input.targetLocale
  const { object } = await runObject({
    feature: "content.translate",
    schema: textSchema,
    system:
      "تو مترجم حرفه‌ای هستی. متن را روان و بومی‌سازی‌شده ترجمه کن و اصطلاحات فنی را درست منتقل کن.",
    userId: actor.userId,
    prompt: `این متن را به ${target} ترجمه کن:\n\n${input.text}`,
  })
  return object
}

// ---------------------------------------------------------------------------
// Task: rewrite / improve
// ---------------------------------------------------------------------------
export async function rewriteText(
  input: { text: string; instruction?: string; tone?: string; locale?: string },
  actor: ContentActor,
): Promise<{ text: string }> {
  const locale = LOCALE_LABEL[input.locale ?? "fa"] ?? "فارسی"
  const { object } = await runObject({
    feature: "content.rewrite",
    schema: textSchema,
    system: BASE_SYSTEM,
    userId: actor.userId,
    prompt: [
      `این متن را به زبان ${locale} بازنویسی و بهبود بده.`,
      input.instruction ? `دستور: ${input.instruction}` : "",
      toneHint(input.tone),
      `\nمتن:\n${input.text}`,
    ]
      .filter(Boolean)
      .join("\n"),
  })
  return object
}

// ---------------------------------------------------------------------------
// Task: inline editor actions (Rich Content Editor bubble menu)
// Operates on a selected fragment and returns semantic-HTML ready to splice
// back into the document. Kept HTML-first so the editor inserts rich nodes,
// not raw text.
// ---------------------------------------------------------------------------
export type InlineAction = "rewrite" | "expand" | "shorten" | "improve" | "translate" | "seo" | "grammar"

const INLINE_INSTRUCTION: Record<InlineAction, string> = {
  rewrite: "این متن را با حفظ معنا بازنویسی کن.",
  expand: "این متن را با جزئیات و توضیح بیشتر گسترش بده.",
  shorten: "این متن را کوتاه‌تر و فشرده‌تر کن بدون حذف نکات کلیدی.",
  improve: "این متن را از نظر نگارش، روانی و جذابیت بهبود بده.",
  translate: "این متن را ترجمه کن.",
  seo: "این متن را برای سئو بهینه کن؛ از کلمات کلیدی طبیعی و ساختار مناسب استفاده کن.",
  grammar: "فقط اشکالات دستوری و املایی این متن را اصلاح کن و ساختار را حفظ کن.",
}

export const inlineHtmlSchema = z.object({
  html: z.string().describe("خروجی به صورت HTML معتبر و معنایی (p, ul, strong, ...) بدون style درون‌خطی"),
})

export async function runInlineAction(
  input: { action: InlineAction; html: string; targetLocale?: string; locale?: string },
  actor: ContentActor,
): Promise<{ html: string }> {
  const locale = LOCALE_LABEL[input.locale ?? "fa"] ?? "فارسی"
  const instruction =
    input.action === "translate"
      ? `این متن را به ${LOCALE_LABEL[input.targetLocale ?? "en"] ?? input.targetLocale ?? "English"} ترجمه کن.`
      : INLINE_INSTRUCTION[input.action]
  const { object } = await runObject({
    feature: `content.inline.${input.action}`,
    schema: inlineHtmlSchema,
    system:
      BASE_SYSTEM +
      " خروجی را فقط به صورت HTML معنایی و تمیز برگردان (بدون تگ <html>/<body> و بدون style درون‌خطی).",
    userId: actor.userId,
    prompt: [
      instruction,
      input.action !== "translate" ? `زبان خروجی: ${locale}.` : "",
      "\nمتن ورودی (HTML):\n",
      input.html,
    ]
      .filter(Boolean)
      .join("\n"),
  })
  return object
}

// ---------------------------------------------------------------------------
// Task: announcement / marketing copy (for notifications, Telegram, email)
// ---------------------------------------------------------------------------
export const announcementSchema = z.object({
  title: z.string().describe("عنوان کوتاه و گیرا"),
  body: z.string().describe("متن اعلان آماده ارسال"),
})
export type Announcement = z.infer<typeof announcementSchema>

export async function generateAnnouncement(
  input: { topic: string; points?: string; channel?: string; tone?: string; locale?: string },
  actor: ContentActor,
): Promise<Announcement> {
  const locale = LOCALE_LABEL[input.locale ?? "fa"] ?? "فارسی"
  const channel = input.channel === "email" ? "ایمیل" : input.channel === "telegram" ? "تلگرام" : "اعلان داخل برنامه"
  const { object } = await runObject({
    feature: "content.announcement",
    schema: announcementSchema,
    system: BASE_SYSTEM,
    userId: actor.userId,
    prompt: [
      `یک متن ${channel} به زبان ${locale} بنویس.`,
      `موضوع: ${input.topic}`,
      input.points ? `نکاتی که باید پوشش داده شود: ${input.points}` : "",
      toneHint(input.tone),
    ]
      .filter(Boolean)
      .join("\n"),
  })
  return object
}

// ---------------------------------------------------------------------------
// Task: sale-plan (variant) description
// ---------------------------------------------------------------------------
// Writes copy for ONE purchasable plan of a product (e.g. the "1-month single
// device" plan of a VPN) given its structured attributes, so each plan reads
// clearly instead of the admin re-describing the whole product every time.
export const planDescriptionSchema = z.object({
  name: z.string().describe("نام کوتاه و گویای پلن، حداکثر ۴۰ کاراکتر"),
  description: z.string().describe("توضیح ۱ تا ۲ پاراگرافی مخصوص همین پلن"),
  bullets: z.array(z.string()).min(2).max(6).describe("۲ تا ۶ ویژگی کلیدی همین پلن"),
})
export type PlanDescription = z.infer<typeof planDescriptionSchema>

function attrsHint(attributes?: Record<string, unknown> | null) {
  if (!attributes || Object.keys(attributes).length === 0) return ""
  const parts = Object.entries(attributes)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "boolean" ? (v ? "بله" : "خیر") : v}`)
  return parts.length ? `مشخصات ساختاریافته پلن:\n${parts.join("\n")}` : ""
}

export async function generatePlanDescription(
  input: {
    productTitle: string
    planName?: string
    attributes?: Record<string, unknown> | null
    notes?: string
    tone?: string
    locale?: string
  },
  actor: ContentActor,
): Promise<PlanDescription> {
  const locale = LOCALE_LABEL[input.locale ?? "fa"] ?? "فارسی"
  const { object } = await runObject({
    feature: "content.plan_description",
    schema: planDescriptionSchema,
    system: BASE_SYSTEM,
    userId: actor.userId,
    prompt: [
      `برای یک پلن فروش مشخص از محصول زیر، متن به زبان ${locale} بنویس. فقط همین پلن را توصیف کن، نه کل محصول.`,
      `محصول: ${input.productTitle}`,
      input.planName ? `نام فعلی پلن: ${input.planName}` : "",
      attrsHint(input.attributes),
      input.notes ? `نکات مهم: ${input.notes}` : "",
      toneHint(input.tone),
    ]
      .filter(Boolean)
      .join("\n"),
  })
  return object
}

// ---------------------------------------------------------------------------
// Task: build sale-plan(s) from a free-text line
// ---------------------------------------------------------------------------
// The admin types a short line (e.g. "۱ ماهه تک‌کاربره ۹۰ هزار") and the AI
// proposes a full plan — name, structured attributes, price and description.
// `count > 1` returns a coherent tiered ladder in one shot (batch mode).
const suggestedPlanSchema = z.object({
  name: z.string().describe("نام کوتاه پلن"),
  description: z.string().describe("توضیح کوتاه مخصوص پلن"),
  bullets: z.array(z.string()).min(2).max(6),
  attributes: z
    .object({
      duration: z.string().nullish().describe("مدت اشتراک مثل '1m'، '3m'، '1y'"),
      devices: z.number().int().nullish().describe("تعداد دستگاه مجاز"),
      accountType: z.enum(["shared", "private"]).nullish().describe("اختصاصی یا اشتراکی"),
      credentialsControl: z.boolean().nullish().describe("امکان تغییر رمز توسط کاربر"),
      twoFactor: z.boolean().nullish().describe("امکان فعال‌سازی تایید دومرحله‌ای"),
      warranty: z.string().nullish().describe("مدت گارانتی/جایگزینی"),
    })
    .describe("مشخصات ساختاریافته پلن"),
  suggestedPrice: z.number().int().nonnegative().nullish().describe("قیمت پیشنهادی به تومان اگر از متن قابل استنباط بود"),
})
export const buildPlansSchema = z.object({
  plans: z.array(suggestedPlanSchema).min(1).max(6),
})
export type SuggestedPlan = z.infer<typeof suggestedPlanSchema>

export async function buildPlansFromPrompt(
  input: { productTitle: string; prompt: string; count?: number; locale?: string },
  actor: ContentActor,
): Promise<{ plans: SuggestedPlan[] }> {
  const locale = LOCALE_LABEL[input.locale ?? "fa"] ?? "فارسی"
  const count = Math.min(Math.max(input.count ?? 1, 1), 6)
  const { object } = await runObject({
    feature: "content.build_plans",
    schema: buildPlansSchema,
    system:
      BASE_SYSTEM +
      " تو در ساخت «پلن‌های فروش» برای یک محصول دیجیتال تخصص داری. هر پلن باید مشخصات ساختاریافته دقیق داشته باشد.",
    userId: actor.userId,
    prompt: [
      count > 1
        ? `برای محصول زیر دقیقاً ${count} پلن فروش پلکانی و منسجم به زبان ${locale} بساز.`
        : `برای محصول زیر یک پلن فروش کامل به زبان ${locale} بساز.`,
      `محصول: ${input.productTitle}`,
      `توضیح ادمین: ${input.prompt}`,
      "اگر قیمتی در متن آمده در suggestedPrice قرار بده، در غیر این صورت آن را خالی بگذار. هرگز قیمت غیرواقعی نساز.",
    ].join("\n"),
  })
  return object
}
