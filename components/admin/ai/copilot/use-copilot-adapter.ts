"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { SUPPORTED_LOCALES, type CopilotLocale } from "@/lib/ai/copilot/entities"
import type { LocalizedValue } from "@/lib/ai/copilot/types"
import type { CopilotAdapter } from "./copilot-provider"

/**
 * One binding per Copilot field key. The form owns the primary (Farsi) scalar
 * state via get/set; localized fields additionally persist per-locale values
 * into an internal i18n store that the form reads back with `getI18n()` at save
 * time. This keeps every admin form's Copilot wiring to a few lines with zero
 * duplicated localization logic.
 */
export interface FieldBinding {
  get: () => unknown
  set: (value: unknown) => void
  /** Localized text/seo field: value arrives as { fa,en,ru,hi } (or per-locale object). */
  localized?: boolean
}

/** Persisted i18n shape: { fa: { title, description, ... }, en: {...}, ... }. */
export type I18nStore = Partial<Record<CopilotLocale, Record<string, unknown>>>

function isLocaleMap(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false
  return SUPPORTED_LOCALES.some((loc) => loc in (v as Record<string, unknown>))
}

/**
 * Build a stable Copilot adapter from field bindings. Returns the adapter plus
 * helpers to read the accumulated i18n object and reset it.
 */
export function useCopilotAdapter(bindings: Record<string, FieldBinding>): {
  adapter: CopilotAdapter
  getI18n: () => I18nStore
  /** True once any non-fa locale value has been generated (worth persisting). */
  hasTranslations: () => boolean
  setI18n: (next: I18nStore) => void
} {
  // Bindings are recreated each render; keep the latest in a ref so the adapter
  // identity stays stable (important: the provider memoizes on `adapter`).
  const bindingsRef = useRef(bindings)
  bindingsRef.current = bindings

  const [i18n, setI18nState] = useState<I18nStore>({})
  const i18nRef = useRef<I18nStore>(i18n)
  i18nRef.current = i18n

  const getForm = useCallback((): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    for (const [key, b] of Object.entries(bindingsRef.current)) {
      if (b.localized) {
        const merged: Record<string, unknown> = {}
        for (const loc of SUPPORTED_LOCALES) {
          const v = i18nRef.current[loc]?.[key]
          if (v !== undefined && v !== "") merged[loc] = v
        }
        // Fall back to the scalar (fa) state when no i18n captured yet.
        if (merged.fa === undefined) {
          const scalar = b.get()
          if (scalar !== undefined && scalar !== "") merged.fa = scalar
        }
        out[key] = merged as LocalizedValue
      } else {
        out[key] = b.get()
      }
    }
    return out
  }, [])

  const applyField = useCallback((key: string, value: unknown) => {
    const b = bindingsRef.current[key]
    if (!b) return
    if (b.localized && isLocaleMap(value)) {
      const map = value as Record<string, unknown>
      setI18nState((prev) => {
        const next: I18nStore = { ...prev }
        for (const loc of SUPPORTED_LOCALES) {
          if (map[loc] === undefined) continue
          next[loc] = { ...(next[loc] ?? {}), [key]: map[loc] }
        }
        i18nRef.current = next
        return next
      })
      // Mirror the primary (fa) value onto the scalar form state.
      if (map.fa !== undefined) b.set(map.fa)
      else {
        const first = SUPPORTED_LOCALES.map((l) => map[l]).find((v) => v !== undefined)
        if (first !== undefined) b.set(first)
      }
    } else {
      b.set(value)
    }
  }, [])

  const adapter = useMemo<CopilotAdapter>(() => ({ getForm, applyField }), [getForm, applyField])

  const getI18n = useCallback(() => i18nRef.current, [])
  const hasTranslations = useCallback(() => {
    return SUPPORTED_LOCALES.filter((l) => l !== "fa").some(
      (l) => i18nRef.current[l] && Object.keys(i18nRef.current[l]!).length > 0,
    )
  }, [])
  const setI18n = useCallback((next: I18nStore) => {
    i18nRef.current = next
    setI18nState(next)
  }, [])

  return { adapter, getI18n, hasTranslations, setI18n }
}
