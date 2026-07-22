import "server-only"
import { z } from "zod"
import { runResearch, type ResearchSource } from "./client"

/**
 * AI price-research assistant — acts like a senior virtual-account reseller.
 *
 * Given a product (and optionally the price the admin typed), it performs LIVE
 * web research restricted to *recent, Iranian, Persian-language* sources that
 * sell virtual accounts/subscriptions, then returns a structured recommendation
 * for the product's "real/original price" (compareAtPrice) anchor.
 *
 * It NEVER trusts the admin's typed number — it researches independently and
 * only recommends. The admin approves (auto-fills the field) or cancels.
 *
 * Feature tag `pricing.research` for analytics + rate scoping.
 */

// Persian curated seed list of active virtual-account marketplaces. Passed as a
// soft include-filter so results skew toward real, up-to-date seller pages.
// (Not exhaustive — the model may still surface other fresh Persian sources.)
const PERSIAN_SELLER_DOMAINS = [
  "ekaj.io",
  "yekchizi.com",
  "digikala.com",
  "torob.com",
  "sabzgard.com",
  "irangb.com",
  "kilid.com",
  "accountgb.com",
  "premiumkharid.com",
  "vpnkharid.com",
]

export const pricingScenario = z.enum(["found", "similar_only", "not_found"])
export type PricingScenario = z.infer<typeof pricingScenario>

export const priceResearchSchema = z.object({
  scenario: pricingScenario.describe(
    "found = نمونهٔ دقیقاً همین محصول پیدا شد؛ similar_only = فقط موارد مشابه (پلن/مدت متفاوت) پیدا شد؛ not_found = هیچ نمونهٔ مشابهی در ایران پیدا نشد",
  ),
  recommendedPrice: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .describe("قیمت اصلی پیشنهادی به تومان (عدد صحیح). اگر قابل تخمین نبود null"),
  priceRangeMin: z.number().int().nonnegative().nullable().describe("کف بازهٔ قیمت مشاهده‌شده به تومان یا null"),
  priceRangeMax: z.number().int().nonnegative().nullable().describe("سقف بازهٔ قیمت مشاهده‌شده به تومان یا null"),
  sampleCount: z.number().int().nonnegative().describe("تعداد منابع/آگهی معتبر و به‌روزی که قیمت از آن‌ها استخراج شد"),
  confidence: z.enum(["high", "medium", "low"]).describe("میزان اطمینان به عدد پیشنهادی"),
  headline: z.string().describe("یک جملهٔ کوتاه و حرفه‌ای که نتیجه را خلاصه می‌کند"),
  advice: z
    .string()
    .describe(
      "مشاورهٔ کامل و حرفه‌ای مثل یک فروشندهٔ سنیور: توضیح یافته‌ها، چرایی عدد پیشنهادی، و در سناریوهای similar_only/not_found توضیح شفاف وضعیت و پیشنهاد منطقی. متن فارسی روان و چند خطی.",
    ),
})
export type PriceResearch = z.infer<typeof priceResearchSchema>

export interface PriceResearchResult extends PriceResearch {
  sources: ResearchSource[]
}

const SYSTEM =
  "تو یک کارشناس ارشد قیمت‌گذاری و فروشندهٔ حرفه‌ای «اکانت‌ها و اشتراک‌های مجازی» در بازار ایران هستی. " +
  "وظیفهٔ تو تحقیق دقیق و به‌روز در سطح اینترنت فارسی برای پیدا کردن قیمت واقعی و روز یک محصول دیجیتال است. " +
  "قوانین سخت‌گیرانه:\n" +
  "۱) فقط و فقط منابع فارسی و فروشگاه‌های ایرانی فروش اکانت مجازی را ملاک قرار بده.\n" +
  "۲) فقط قیمت‌های جدید و به‌روز (حداکثر یک ماه اخیر) را ملاک بگیر؛ آگهی‌ها و قیمت‌های قدیمی و منسوخ را کاملاً نادیده بگیر.\n" +
  "۳) هرگز به عددی که ادمین وارد کرده تکیه نکن؛ مستقل تحقیق کن.\n" +
  "۴) میانگین منطقی بگیر و پرت‌ها (قیمت‌های به‌شدت پایین/بالا) را حذف کن.\n" +
  "۵) اگر دقیقاً همین محصول را پیدا نکردی ولی موارد مشابه (پلن/مدت متفاوت) بود، سناریو را similar_only بگذار و در advice شفاف توضیح بده که نمونهٔ دقیق پیدا نشد و چه مواردی مشابه بودند و ترجیحاً چه عددی ثبت شود.\n" +
  "۶) اگر هیچ نمونهٔ مشابهی در ایران نبود، سناریو را not_found بگذار و با توجه به قیمت جهانی محصول یک عدد منطقی پیشنهاد بده و دلیلش را بگو.\n" +
  "۷) همهٔ اعداد قیمت را به «تومان» و به‌صورت عدد صحیح گزارش کن. لحن مشاوره مثل یک فروشندهٔ سنیور، واضح و حرفه‌ای باشد."

export interface PriceResearchInput {
  /** Product title / name being priced. */
  title: string
  /** Optional plan/variant name (e.g. "پلن بیس ۱ ماهه"). */
  planName?: string | null
  /** Optional category for disambiguation. */
  category?: string | null
  /** The price the admin currently typed (context only — never trusted). */
  currentPrice?: number | null
}

export async function researchProductPrice(
  input: PriceResearchInput,
  actor: { userId?: string | null },
): Promise<PriceResearchResult> {
  const productLabel = [input.title, input.planName].filter(Boolean).join(" — ")
  const { object, sources } = await runResearch({
    feature: "pricing.research",
    schema: priceResearchSchema,
    system: SYSTEM,
    userId: actor.userId,
    refType: "product_pricing",
    // Web-search needs more time than a normal call (multiple search rounds).
    timeoutMs: 90_000,
    maxSteps: 4,
    searchConfig: {
      country: "IR",
      searchLanguageFilter: ["fa"],
      searchRecencyFilter: "month",
      searchDomainFilter: PERSIAN_SELLER_DOMAINS,
      maxResults: 12,
    },
    prompt: [
      `محصول: ${productLabel}`,
      input.category ? `دستهبندی: ${input.category}` : "",
      "این محصول یک اکانت/اشتراک مجازی است. در سایت‌های فارسی و فروشگاه‌های ایرانی فروش اکانت مجازی جستجو کن و قیمت‌های روز و به‌روز آن را پیدا کن.",
      "با چند عبارت جستجوی مختلف (نام محصول + پلن + قیمت + خرید) بگرد تا نتایج کامل باشد.",
      "سپس میانگین منطقی قیمت‌های جدید را محاسبه کن و طبق قوانین، سناریو و مشاورهٔ نهایی را بده.",
    ]
      .filter(Boolean)
      .join("\n"),
  })
  return { ...object, sources }
}
