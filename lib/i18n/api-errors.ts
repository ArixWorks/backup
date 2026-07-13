import { ApiError } from "@/lib/api-client"
import type { Locale } from "./locales"

type LocalizedMessages = Record<Locale, string>

const FALLBACK: LocalizedMessages = {
  fa: "مشکلی پیش آمد. لطفاً دوباره تلاش کنید.",
  en: "Something went wrong. Please try again.",
  ru: "Что-то пошло не так. Попробуйте ещё раз.",
  hi: "Kuch galat ho gaya. Dobara koshish karein.",
}

const MESSAGES: Record<string, LocalizedMessages> = {
  NO_INVENTORY: { fa: "این محصول فعلاً موجود نیست.", en: "This product is currently out of stock.", ru: "Этого товара сейчас нет в наличии.", hi: "Yeh product abhi stock mein nahi hai." },
  INSUFFICIENT_FUNDS: { fa: "موجودی کیف پول شما کافی نیست.", en: "Your wallet balance is not enough.", ru: "На вашем кошельке недостаточно средств.", hi: "Aapke wallet mein balance kam hai." },
  NOT_FOUND: { fa: "مورد درخواستی پیدا نشد.", en: "We could not find what you requested.", ru: "Запрошенный объект не найден.", hi: "Aapki maangi hui cheez nahi mili." },
  PRODUCT_NOT_FOUND: { fa: "این محصول پیدا نشد یا دیگر در دسترس نیست.", en: "This product was not found or is no longer available.", ru: "Товар не найден или больше недоступен.", hi: "Yeh product nahi mila ya ab available nahi hai." },
  UNAUTHORIZED: { fa: "لطفاً ابتدا وارد حساب خود شوید.", en: "Please sign in first.", ru: "Сначала войдите в аккаунт.", hi: "Pehle apne account mein sign in karein." },
  FORBIDDEN: { fa: "شما اجازه انجام این کار را ندارید.", en: "You do not have permission to do this.", ru: "У вас нет разрешения на это действие.", hi: "Aapko yeh karne ki ijazat nahi hai." },
  VALIDATION: { fa: "اطلاعات واردشده درست نیست. لطفاً دوباره بررسی کنید.", en: "Some information is not valid. Please check it and try again.", ru: "Некоторые данные неверны. Проверьте их и повторите попытку.", hi: "Kuch jaankari sahi nahi hai. Check karke dobara koshish karein." },
  CONFLICT: { fa: "این اطلاعات تغییر کرده است. صفحه را تازه کنید و دوباره تلاش کنید.", en: "This information has changed. Refresh and try again.", ru: "Данные изменились. Обновите страницу и повторите попытку.", hi: "Yeh jaankari badal gayi hai. Page refresh karke dobara koshish karein." },
  RATE_LIMITED: { fa: "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.", en: "Too many requests. Please try again shortly.", ru: "Слишком много запросов. Попробуйте чуть позже.", hi: "Bahut zyada requests hain. Thodi der baad koshish karein." },
  INTERNAL: { fa: "مشکلی در سیستم پیش آمد. لطفاً کمی بعد دوباره تلاش کنید.", en: "There is a temporary system problem. Please try again shortly.", ru: "Временная ошибка системы. Попробуйте чуть позже.", hi: "System mein temporary problem hai. Thodi der baad koshish karein." },
  COUPON_INVALID: { fa: "کد تخفیف معتبر نیست.", en: "This coupon code is not valid.", ru: "Промокод недействителен.", hi: "Yeh coupon code valid nahi hai." },
  COUPON_EXPIRED: { fa: "زمان استفاده از این کد تخفیف تمام شده است.", en: "This coupon has expired.", ru: "Срок действия промокода истёк.", hi: "Yeh coupon expire ho chuka hai." },
  OUT_OF_STOCK: { fa: "موجودی این محصول کافی نیست.", en: "There is not enough stock for this product.", ru: "Недостаточно товара в наличии.", hi: "Is product ka stock kaafi nahi hai." },
  AUCTION_ENDED: { fa: "این مزایده پایان یافته است.", en: "This auction has ended.", ru: "Аукцион завершён.", hi: "Yeh auction khatam ho chuka hai." },
  BID_TOO_LOW: { fa: "مبلغ پیشنهاد شما کمتر از حد مجاز است.", en: "Your bid is below the minimum amount.", ru: "Ваша ставка ниже минимальной.", hi: "Aapki bid minimum amount se kam hai." },
  AI_DISABLED: { fa: "سرویس هوش مصنوعی فعلاً غیرفعال است.", en: "The AI service is currently disabled.", ru: "Сервис ИИ сейчас отключён.", hi: "AI service abhi band hai." },
  AI_NOT_CONFIGURED: { fa: "سرویس هوش مصنوعی هنوز تنظیم نشده است.", en: "The AI service has not been configured yet.", ru: "Сервис ИИ ещё не настроен.", hi: "AI service abhi configure nahi hui hai." },
  AI_BUDGET_EXCEEDED: { fa: "سقف استفاده امروز از هوش مصنوعی پر شده است.", en: "Today's AI usage limit has been reached.", ru: "Достигнут дневной лимит ИИ.", hi: "Aaj ki AI usage limit poori ho gayi hai." },
  AI_PROVIDER_ERROR: { fa: "ارتباط با سرویس هوش مصنوعی برقرار نشد. دوباره تلاش کنید.", en: "We could not reach the AI service. Please try again.", ru: "Не удалось подключиться к сервису ИИ. Попробуйте ещё раз.", hi: "AI service se connection nahi hua. Dobara koshish karein." },
}

function codeOf(error: unknown): string | null {
  if (error instanceof ApiError) return error.code
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") return error.code
  return null
}

export function localizeApiError(error: unknown, locale: Locale): string {
  const code = codeOf(error)
  if (code && MESSAGES[code]) return MESSAGES[code][locale]
  return FALLBACK[locale]
}

export function localizeErrorCode(code: string | null | undefined, locale: Locale): string {
  return (code && MESSAGES[code]?.[locale]) || FALLBACK[locale]
}
