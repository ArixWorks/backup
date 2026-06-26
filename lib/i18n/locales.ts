/**
 * Locale primitives shared by the bot (server) and the web app (client).
 * Persian (fa) is the default; English/Russian/Hindi are also supported.
 */

export const LOCALES = ["fa", "en", "ru", "hi"] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = "fa"

export const LOCALE_NAMES: Record<Locale, string> = {
  fa: "فارسی",
  en: "English",
  ru: "Русский",
  hi: "हिन्दी",
}

/** Short flag emoji for the language switcher. */
export const LOCALE_FLAGS: Record<Locale, string> = {
  fa: "🇮🇷",
  en: "🇬🇧",
  ru: "🇷🇺",
  hi: "🇮🇳",
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value)
}

/** Only Persian renders right-to-left. */
export function isRTL(locale: Locale): boolean {
  return locale === "fa"
}

/**
 * Map a Telegram `language_code` (e.g. "en", "en-US", "fa", "ru", "hi") to a
 * supported locale. Anything unknown falls back to the default (fa).
 */
export function tgLangToLocale(code: string | null | undefined): Locale {
  if (!code) return DEFAULT_LOCALE
  const base = code.toLowerCase().split("-")[0]
  if (isLocale(base)) return base
  return DEFAULT_LOCALE
}

/** Persian uses Toman; every other locale displays USD. */
export function localeCurrency(locale: Locale): "toman" | "usd" {
  return locale === "fa" ? "toman" : "usd"
}
