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
