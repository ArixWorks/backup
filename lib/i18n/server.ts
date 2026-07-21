import "server-only"

import { cookies } from "next/headers"
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/locales"

export async function getRequestLocale(): Promise<Locale> {
  const value = (await cookies()).get("subio_locale")?.value
  return isLocale(value) ? value : DEFAULT_LOCALE
}

const COPY = {
  purchasedTutorials: {
    fa: "آموزش‌های خریداری‌شده",
    en: "Purchased tutorials",
    hi: "खरीदे गए ट्यूटोरियल",
    ru: "Купленные руководства",
  },
  purchasedTutorialsDescription: {
    fa: "فقط آموزش‌های متصل به سفارش‌های تحویل‌شده شما نمایش داده می‌شوند.",
    en: "Only tutorials linked to your delivered orders are shown.",
    hi: "केवल आपके डिलीवर किए गए ऑर्डर से जुड़े ट्यूटोरियल दिखाए जाते हैं।",
    ru: "Показаны только руководства, связанные с доставленными заказами.",
  },
  noTutorials: {
    fa: "هنوز آموزشی در دسترس نیست",
    en: "No tutorials available yet",
    hi: "अभी कोई ट्यूटोरियल उपलब्ध नहीं है",
    ru: "Руководств пока нет",
  },
  noTutorialsDescription: {
    fa: "پس از تحویل سفارش، آموزش مرتبط از این بخش و صفحه سفارش‌ها قابل مشاهده است.",
    en: "After delivery, the related tutorial will appear here and on the orders page.",
    hi: "डिलीवरी के बाद संबंधित ट्यूटोरियल यहाँ और ऑर्डर पेज पर दिखाई देगा।",
    ru: "После доставки связанное руководство появится здесь и на странице заказов.",
  },
  viewOrders: { fa: "مشاهده سفارش‌ها", en: "View orders", hi: "ऑर्डर देखें", ru: "Посмотреть заказы" },
  signInTutorials: {
    fa: "برای مشاهده آموزش‌های خریداری‌شده وارد حساب شوید.",
    en: "Sign in to view your purchased tutorials.",
    hi: "खरीदे गए ट्यूटोरियल देखने के लिए साइन इन करें।",
    ru: "Войдите, чтобы посмотреть купленные руководства.",
  },
  articles: { fa: "مقالات", en: "Articles", hi: "लेख", ru: "Статьи" },
  articlesDescription: { fa: "آخرین مطالب و راهنماهای مجله", en: "Latest stories and guides", hi: "नवीनतम लेख और गाइड", ru: "Последние статьи и руководства" },
  help: { fa: "مرکز راهنما", en: "Help center", hi: "सहायता केंद्र", ru: "Центр помощи" },
  helpDescription: { fa: "مقالات پشتیبانی و مرکز راهنما", en: "Support articles and guides", hi: "सहायता लेख और गाइड", ru: "Статьи поддержки и руководства" },
  faq: { fa: "پرسش‌های متداول", en: "Frequently asked questions", hi: "अक्सर पूछे जाने वाले प्रश्न", ru: "Частые вопросы" },
  faqDescription: { fa: "پاسخ سوالات پرتکرار شما", en: "Answers to common questions", hi: "सामान्य प्रश्नों के उत्तर", ru: "Ответы на частые вопросы" },
  unpublished: { fa: "محتوای این صفحه هنوز منتشر نشده است", en: "This page has not been published yet.", hi: "यह पेज अभी प्रकाशित नहीं हुआ है।", ru: "Эта страница еще не опубликована." },
} as const

export type ServerCopyKey = keyof typeof COPY

export function serverCopy(key: ServerCopyKey, locale: Locale) {
  return COPY[key][locale]
}
