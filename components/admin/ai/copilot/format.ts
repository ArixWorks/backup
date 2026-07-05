import { LOCALE_LABEL, SUPPORTED_LOCALES, type CopilotLocale } from "@/lib/ai/copilot/entities"

/** Best-effort human-readable preview of any Copilot field value. */
export function previewValue(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return value
  if (typeof value === "number") return String(value)
  if (Array.isArray(value)) return value.map((v) => String(v)).join("، ")
  if (typeof value === "object") {
    const rec = value as Record<string, unknown>
    // SEO block
    if ("metaTitle" in rec || "metaDescription" in rec) {
      const parts = [rec.metaTitle, rec.metaDescription].filter(Boolean)
      return parts.map((p) => String(p)).join(" — ")
    }
    // localized value
    const fa = rec.fa
    if (typeof fa === "string") return fa
    // localized SEO or object of locales
    for (const l of SUPPORTED_LOCALES) {
      const v = rec[l]
      if (typeof v === "string") return v
      if (v && typeof v === "object") return previewValue(v)
    }
    return JSON.stringify(rec)
  }
  return String(value)
}

/** Extract the fa/primary string from a value for feedback diffing. */
export function primaryString(value: unknown): string {
  return previewValue(value)
}

/** For localized values, return per-locale strings for the translation tabs. */
export function localizedEntries(value: unknown): { locale: CopilotLocale; label: string; text: string }[] {
  const rec = (value && typeof value === "object" ? value : {}) as Record<string, unknown>
  return SUPPORTED_LOCALES.map((locale) => {
    const raw = rec[locale]
    let text = ""
    if (typeof raw === "string") text = raw
    else if (raw && typeof raw === "object") text = previewValue(raw)
    return { locale, label: LOCALE_LABEL[locale], text }
  })
}
