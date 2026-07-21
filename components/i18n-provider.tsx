"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { fetcher } from "@/lib/api-client"
import {
  type Locale,
  DEFAULT_LOCALE,
  isLocale,
  isRTL,
  tgLangToLocale,
} from "@/lib/i18n/locales"
import { MESSAGES, interpolate, type MessageKey, type MessageVars } from "@/lib/i18n/messages"
import { localizeApiError } from "@/lib/i18n/api-errors"
import {
  formatPrice,
  formatPriceValue,
  formatPriceCompactParts,
  currencyLabel,
  DEFAULT_USD_RATE,
} from "@/lib/i18n/currency"

type I18nContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: MessageKey, vars?: MessageVars) => string
  errorMessage: (error: unknown) => string
  /** Format a Toman amount into the active locale's currency (with symbol/word). */
  price: (toman: bigint | number | string) => string
  /** Numeric-only price (no currency word). */
  priceValue: (toman: bigint | number | string) => string
  /** Compact price split into value + suffix for tight spaces (header pill). */
  priceCompact: (toman: bigint | number | string) => { value: string; suffix: string }
  /** Locale-aware plain integer formatting (Persian digits for fa, Latin otherwise). */
  num: (value: number) => string
  currency: string
  dir: "rtl" | "ltr"
}

const I18nContext = createContext<I18nContextValue | null>(null)

const STORAGE_KEY = "subio_locale"

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  // Public config (default locale + USD rate). Falls back to sane defaults.
  const { data: cfg } = useSWR<{ data: { defaultLocale: Locale; usdRate: number } }>(
    "/api/v1/public/config",
    fetcher,
  )
  // Session carries the user's persisted languageCode (from Telegram or manual).
  const { data: session } = useSWR<{ data: { languageCode?: string | null } | null }>(
    "/api/v1/auth/session",
    fetcher,
  )

  const [override, setOverride] = useState<Locale | null>(null)

  // Read any locally-stored manual choice on mount (instant, no flicker).
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (isLocale(stored)) setOverride(stored)
    } catch {
      /* ignore */
    }
  }, [])

  // Resolve the active locale with a clear precedence:
  // local override > persisted user language > config default > Telegram lang > fa
  const locale: Locale = useMemo(() => {
    if (override) return override
    const userLang = session?.data?.languageCode
    if (userLang && isLocale(userLang)) return userLang
    if (userLang) return tgLangToLocale(userLang)
    if (cfg?.data?.defaultLocale && isLocale(cfg.data.defaultLocale)) return cfg.data.defaultLocale
    return DEFAULT_LOCALE
  }, [override, session?.data?.languageCode, cfg?.data?.defaultLocale])

  const usdRate = cfg?.data?.usdRate ?? DEFAULT_USD_RATE

  // Keep <html> lang/dir in sync so the whole app flips RTL/LTR correctly.
  useEffect(() => {
    const el = document.documentElement
    el.lang = locale
    el.dir = isRTL(locale) ? "rtl" : "ltr"
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setOverride(next)
    document.cookie = `${STORAGE_KEY}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
    // Persist server-side too (best-effort; ignored when not signed in).
    fetch("/api/v1/auth/locale", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ locale: next }),
    }).catch(() => {})
    router.refresh()
  }, [router])

  const value = useMemo<I18nContextValue>(() => {
    const catalog = MESSAGES[locale]
    return {
      locale,
      setLocale,
      t: (key, vars) => interpolate(catalog[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key, vars),
      errorMessage: (error) => localizeApiError(error, locale),
      price: (toman) => formatPrice(toman, locale, usdRate),
      priceValue: (toman) => formatPriceValue(toman, locale, usdRate),
      priceCompact: (toman) => formatPriceCompactParts(toman, locale, usdRate),
      num: (value) => new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(value),
      currency: currencyLabel(locale),
      dir: isRTL(locale) ? "rtl" : "ltr",
    }
  }, [locale, setLocale, usdRate])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used within I18nProvider")
  return ctx
}
