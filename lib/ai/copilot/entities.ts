/**
 * Copilot entity registry — the single source of truth describing every admin
 * form the AI Copilot can drive. Shared by the server (to build the structured
 * generation schema + prompts) and the client (to render suggestions, image
 * slots and the preview diff). No secrets here; safe to import on both sides.
 *
 * Adding a new entity later (VPS, domain, article, FAQ, notification) is pure
 * config — declare its fields here and wire the form adapter. No engine changes.
 */

import type { ImageAspect } from "../image/settings"

/** How a field is rendered/edited in the target form. Drives preview + apply. */
export type CopilotFieldType =
  | "text"
  | "textarea"
  | "richtext"
  | "number"
  | "money"
  | "select"
  | "tags"
  | "image"
  | "seo"

export interface CopilotFieldDef {
  /** Key in the Form Object AND in the target form state adapter. */
  key: string
  label: string
  type: CopilotFieldType
  /** Localized fields get a value per locale (fa/en/ru/hi). */
  localized?: boolean
  /** For `select` — allowed options (value + label). */
  options?: { value: string; label: string }[]
  /** Marks the field important enough to carry an Explain-Decision reason. */
  explainable?: boolean
  hint?: string
  /** Whether AI should attempt to fill this field (some are admin-only). */
  aiFillable?: boolean
}

export interface CopilotImageSlot {
  key: string
  label: string
  aspect: ImageAspect
  /** Maps the generated URL onto this form field (e.g. coverImage). */
  formField?: string
  gallery?: boolean
}

export interface CopilotEntityDef {
  id: string
  label: string
  /** Blob folder for generated imagery. */
  imageFolder: string
  /** System persona for this entity's generations. */
  systemPrompt: string
  fields: CopilotFieldDef[]
  imageSlots: CopilotImageSlot[]
  /** True when the entity supports similar/duplicate detection against catalog. */
  detectSimilar?: boolean
  /** True when the AI may recommend a sale type (product only). */
  recommendSaleType?: boolean
}

export const SUPPORTED_LOCALES = ["fa", "en", "ru", "hi"] as const
export type CopilotLocale = (typeof SUPPORTED_LOCALES)[number]

export const LOCALE_LABEL: Record<CopilotLocale, string> = {
  fa: "فارسی",
  en: "English",
  ru: "Русский",
  hi: "हिन्दी",
}

const DELIVERY_OPTIONS = [
  { value: "MANUAL", label: "دستی (توسط پشتیبان)" },
  { value: "AUTOMATIC", label: "خودکار (از مخزن موجودی)" },
]

const PRODUCT_SYSTEM =
  "تو مدیر محصول و کپی‌رایتر ارشد یک فروشگاه محصولات دیجیتال فارسی‌زبان (SubIO) هستی. " +
  "بر اساس توضیح کوتاه مدیر، تمام فیلدهای فرم محصول را حرفه‌ای، واقع‌گرایانه و سئو-دوست پر کن. " +
  "قیمت‌ها را منطقی و متناسب با بازار ایران (تومان) پیشنهاد بده و هرگز اطلاعات ساختگی نساز."

/**
 * Product (unified flash + auction). The Copilot generates the shared content
 * fields plus pricing for BOTH modes and recommends the best sale type; the
 * form adapter applies only the fields relevant to the active tab.
 */
const productEntity: CopilotEntityDef = {
  id: "product",
  label: "محصول",
  imageFolder: "products",
  systemPrompt: PRODUCT_SYSTEM,
  detectSimilar: true,
  recommendSaleType: true,
  fields: [
    { key: "title", label: "عنوان محصول", type: "text", localized: true, explainable: false, aiFillable: true },
    { key: "shortDescription", label: "توضیح کوتاه", type: "textarea", localized: true, aiFillable: true },
    { key: "description", label: "توضیحات کامل", type: "richtext", localized: true, aiFillable: true },
    { key: "category", label: "دسته‌بندی", type: "text", explainable: true, aiFillable: true },
    { key: "tags", label: "برچسب‌ها", type: "tags", aiFillable: true },
    {
      key: "deliveryType",
      label: "نوع تحویل",
      type: "select",
      options: DELIVERY_OPTIONS,
      explainable: true,
      aiFillable: true,
    },
    { key: "price", label: "قیمت فروشگاهی (تومان)", type: "money", explainable: true, aiFillable: true },
    { key: "stock", label: "موجودی انبار", type: "number", aiFillable: true },
    { key: "startPrice", label: "قیمت پایه مزایده (تومان)", type: "money", explainable: true, aiFillable: true },
    { key: "minimumIncrement", label: "حداقل افزایش پیشنهاد", type: "money", aiFillable: true },
    { key: "buyNowPrice", label: "قیمت خرید فوری", type: "money", aiFillable: true },
    { key: "seo", label: "سئو و متادیتا", type: "seo", localized: true, explainable: true, aiFillable: true },
  ],
  imageSlots: [
    { key: "cover", label: "تصویر کاور", aspect: "16:9", formField: "coverImage" },
    { key: "thumbnail", label: "تصویر بندانگشتی", aspect: "1:1" },
    { key: "banner", label: "بنر", aspect: "16:9" },
    { key: "gallery", label: "گالری", aspect: "4:5", gallery: true },
    { key: "og", label: "تصویر Open Graph", aspect: "16:9" },
    { key: "telegram", label: "پیش‌نمایش تلگرام", aspect: "1:1" },
  ],
}

const GIVEAWAY_SYSTEM =
  "تو مدیر کمپین‌های قرعه‌کشی یک پلتفرم فارسی‌زبان هستی. متن‌های هیجان‌انگیز اما صادقانه بنویس " +
  "و جزئیات جایزه را شفاف بیان کن."

const giveawayEntity: CopilotEntityDef = {
  id: "giveaway",
  label: "قرعه‌کشی",
  imageFolder: "giveaways",
  systemPrompt: GIVEAWAY_SYSTEM,
  fields: [
    { key: "title", label: "عنوان قرعه‌کشی", type: "text", localized: true, aiFillable: true },
    { key: "subtitle", label: "زیرعنوان", type: "text", localized: true, aiFillable: true },
    { key: "description", label: "توضیحات", type: "richtext", localized: true, aiFillable: true },
    { key: "prizeLabel", label: "برچسب جایزه", type: "text", explainable: true, aiFillable: true },
    { key: "winnersCount", label: "تعداد برندگان", type: "number", aiFillable: true },
    { key: "internalNotes", label: "یادداشت داخلی", type: "textarea", aiFillable: true },
  ],
  imageSlots: [
    { key: "cover", label: "تصویر کاور", aspect: "16:9", formField: "coverImage" },
    { key: "prize", label: "تصویر جایزه", aspect: "1:1", formField: "prizeImage" },
    { key: "telegram", label: "پیش‌نمایش تلگرام", aspect: "1:1" },
  ],
}

const COUPON_SYSTEM =
  "تو مسئول کمپین‌های تخفیف یک فروشگاه دیجیتال فارسی‌زبان هستی. کد و توضیح تخفیف جذاب و کوتاه بساز."

const couponEntity: CopilotEntityDef = {
  id: "coupon",
  label: "کد تخفیف",
  imageFolder: "coupons",
  systemPrompt: COUPON_SYSTEM,
  fields: [
    { key: "code", label: "کد تخفیف", type: "text", explainable: true, aiFillable: true },
    { key: "description", label: "توضیح تخفیف", type: "textarea", localized: true, aiFillable: true },
  ],
  imageSlots: [],
}

const CHANNEL_SYSTEM =
  "تو مدیر محتوای کانال تلگرام یک فروشگاه دیجیتال فارسی‌زبان هستی. پست‌های کوتاه، گیرا و call-to-action-دار بنویس."

const channelEntity: CopilotEntityDef = {
  id: "channel-post",
  label: "پست کانال",
  imageFolder: "channel",
  systemPrompt: CHANNEL_SYSTEM,
  fields: [
    { key: "title", label: "عنوان پست", type: "text", localized: true, aiFillable: true },
    { key: "body", label: "متن پست", type: "richtext", localized: true, aiFillable: true },
  ],
  imageSlots: [{ key: "cover", label: "تصویر پست", aspect: "16:9", formField: "image" }],
}

const EMAIL_SYSTEM =
  "تو نویسنده ایمیل‌های بازاریابی یک فروشگاه دیجیتال فارسی‌زبان هستی. موضوع و بدنه ایمیل حرفه‌ای و متقاعدکننده بنویس."

const emailEntity: CopilotEntityDef = {
  id: "email",
  label: "ایمیل",
  imageFolder: "email",
  systemPrompt: EMAIL_SYSTEM,
  fields: [
    { key: "subject", label: "موضوع ایمیل", type: "text", localized: true, aiFillable: true },
    { key: "body", label: "متن ایمیل", type: "richtext", localized: true, aiFillable: true },
  ],
  imageSlots: [],
}

export const COPILOT_ENTITIES: Record<string, CopilotEntityDef> = {
  [productEntity.id]: productEntity,
  [giveawayEntity.id]: giveawayEntity,
  [couponEntity.id]: couponEntity,
  [channelEntity.id]: channelEntity,
  [emailEntity.id]: emailEntity,
}

export function getEntityDef(id: string): CopilotEntityDef | undefined {
  return COPILOT_ENTITIES[id]
}

export const COPILOT_ENTITY_IDS = Object.keys(COPILOT_ENTITIES)
