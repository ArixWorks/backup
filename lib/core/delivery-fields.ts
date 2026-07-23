/**
 * Shared, client-safe types and helpers for the dynamic credential-delivery
 * field template. A "template" is an ordered list of field definitions authored
 * by the admin per product (optionally overridden per sale plan). Actual
 * credential values are stored as a { [key]: value } map on inventory items and
 * on the delivered payload, keyed to this template.
 *
 * This module is intentionally free of server-only imports so it can be used by
 * both React client components and server code.
 */

import { z } from "zod"

export const DELIVERY_FIELD_TYPES = [
  "text",
  "password",
  "email",
  "username",
  "url",
  "note",
  "totp",
] as const

export type DeliveryFieldType = (typeof DELIVERY_FIELD_TYPES)[number]

/** Localized label. `fa` is required (primary); other locales optional. */
export interface LocalizedLabel {
  fa: string
  en?: string
  ru?: string
  hi?: string
}

export interface DeliveryFieldDef {
  /** Stable machine key used in the values map, e.g. "email". */
  key: string
  label: LocalizedLabel
  type: DeliveryFieldType
  /** Admin must fill this when entering a delivery. */
  required?: boolean
  /** Mask by default in the UI (passwords, keys). */
  sensitive?: boolean
  /** Optional input hint. */
  placeholder?: string
}

export type DeliveryTemplate = DeliveryFieldDef[]

/** Map of resolved field key -> delivered string value. */
export type DeliveryValues = Record<string, string>

// ---------------------------------------------------------------------------
// Zod validation
// ---------------------------------------------------------------------------

const KEY_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/

export const localizedLabelSchema = z.object({
  fa: z.string().trim().min(1).max(60),
  en: z.string().trim().max(60).optional(),
  ru: z.string().trim().max(60).optional(),
  hi: z.string().trim().max(60).optional(),
})

export const deliveryFieldSchema = z.object({
  key: z.string().trim().regex(KEY_RE, "کلید نامعتبر است (فقط حروف/عدد/زیرخط)"),
  label: localizedLabelSchema,
  type: z.enum(DELIVERY_FIELD_TYPES),
  required: z.boolean().optional(),
  sensitive: z.boolean().optional(),
  placeholder: z.string().trim().max(120).optional(),
})

export const deliveryTemplateSchema = z
  .array(deliveryFieldSchema)
  .max(20)
  .superRefine((fields, ctx) => {
    const seen = new Set<string>()
    for (const f of fields) {
      if (seen.has(f.key)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `کلید تکراری: ${f.key}` })
      }
      seen.add(f.key)
    }
  })

// ---------------------------------------------------------------------------
// Defaults & resolution
// ---------------------------------------------------------------------------

/** Fallback template used when a product has not defined one. */
export const DEFAULT_FIELD_TEMPLATE: DeliveryTemplate = [
  { key: "username", label: { fa: "نام کاربری", en: "Username" }, type: "username" },
  { key: "password", label: { fa: "رمز عبور", en: "Password" }, type: "password", sensitive: true },
]

/** Parse/normalize an unknown JSON value into a valid template (or null). */
export function parseTemplate(value: unknown): DeliveryTemplate | null {
  if (value == null) return null
  const result = deliveryTemplateSchema.safeParse(value)
  if (!result.success || result.data.length === 0) return null
  return result.data
}

/**
 * Resolve the effective template: variant override → product → default.
 * Accepts the raw JSON columns so callers can pass DB rows directly.
 */
export function resolveTemplate(
  productFields: unknown,
  variantFields?: unknown,
): DeliveryTemplate {
  return (
    parseTemplate(variantFields) ??
    parseTemplate(productFields) ??
    DEFAULT_FIELD_TEMPLATE
  )
}

// ---------------------------------------------------------------------------
// Legacy compatibility
// ---------------------------------------------------------------------------

/** Legacy typed inventory columns, mapped to canonical field keys. */
const LEGACY_KEYS = ["username", "password", "licenseKey", "note"] as const

/**
 * Build a values map from an inventory item, preferring the dynamic `fields`
 * column and falling back to the legacy typed columns. Used by the automatic
 * delivery path so pre-migration items keep working.
 */
export function inventoryToValues(item: {
  fields?: unknown
  username?: string | null
  password?: string | null
  licenseKey?: string | null
  note?: string | null
}): DeliveryValues {
  const out: DeliveryValues = {}
  const dynamic = item.fields
  if (dynamic && typeof dynamic === "object" && !Array.isArray(dynamic)) {
    for (const [k, v] of Object.entries(dynamic as Record<string, unknown>)) {
      if (v != null && String(v).trim() !== "") out[k] = String(v)
    }
  }
  // Backfill from legacy columns only when not already present dynamically.
  for (const k of LEGACY_KEYS) {
    const v = item[k]
    if (v != null && String(v).trim() !== "" && out[k] === undefined) out[k] = String(v)
  }
  return out
}

/**
 * Keep only values whose keys exist in the template and are non-empty. Enforces
 * required fields. Returns the cleaned map. Throws Error listing missing
 * required labels when validation fails (caller maps to a 400).
 */
export function sanitizeValues(
  template: DeliveryTemplate,
  values: Record<string, unknown>,
  locale: "fa" | "en" | "ru" | "hi" = "fa",
): DeliveryValues {
  const out: DeliveryValues = {}
  const missing: string[] = []
  for (const field of template) {
    // TOTP fields carry no plaintext value (handled by the 2FA subsystem).
    if (field.type === "totp") continue
    const raw = values[field.key]
    const str = raw == null ? "" : String(raw).trim()
    if (str === "") {
      if (field.required) missing.push(fieldLabel(field, locale))
      continue
    }
    out[field.key] = str
  }
  if (missing.length > 0) {
    throw new Error(`فیلدهای الزامی خالی هستند: ${missing.join("، ")}`)
  }
  return out
}

/** Pick the best label for a locale, falling back to fa then key. */
export function fieldLabel(field: DeliveryFieldDef, locale: "fa" | "en" | "ru" | "hi" = "fa"): string {
  return field.label[locale] || field.label.fa || field.key
}
