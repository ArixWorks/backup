import { z } from "zod"

/**
 * Type-driven CMS: the contract every content type declares.
 *
 * A content type is pure configuration — no schema change is needed to add one.
 * The registry turns these declarations into: Zod validation for custom fields,
 * admin editor UI, public routing, taxonomy, relations and navigation.
 */

export type NavPlacement = "HEADER" | "FOOTER" | "SIDEBAR"

/** Supported custom-field primitives rendered by the admin editor. */
export type FieldType =
  | "text"
  | "textarea"
  | "richtext"
  | "number"
  | "boolean"
  | "select"
  | "url"
  | "image"
  | "date"

export interface FieldOption {
  value: string
  label: string
}

/** A single type-specific custom field, stored inside `Content.fields` (JSON). */
export interface FieldDef {
  key: string
  label: string
  type: FieldType
  required?: boolean
  placeholder?: string
  help?: string
  /** For `select`. */
  options?: FieldOption[]
  /** For `number`. */
  min?: number
  max?: number
  /** For `text`/`textarea`. */
  maxLength?: number
  default?: string | number | boolean
}

export type RelationTargetType =
  | `content:${string}` // another content type, e.g. "content:article"
  | "product"
  | "auction"
  | "giveaway"

/** A declared relation slot, e.g. "relatedProducts" linking to products. */
export interface RelationDef {
  key: string
  label: string
  targetType: RelationTargetType
  multiple?: boolean
  max?: number
  help?: string
}

export interface TypeNavigationConfig {
  /** Whether items of this type may appear in site navigation at all. */
  canAppearInNav: boolean
  defaultPlacement: NavPlacement[]
  defaultIcon?: string
  defaultShow: boolean
}

/** How a content type maps to public URLs. */
export interface RoutingConfig {
  /** Public base path, e.g. "/articles". Empty for singletons mounted elsewhere. */
  basePath: string
  /**
   * "collection" -> list at basePath + detail at basePath/[slug]
   * "singleton"  -> exactly one document rendered at basePath (e.g. /rules)
   */
  mode: "collection" | "singleton"
}

export type ContentCapability = "view" | "create" | "update" | "publish" | "delete"

export interface ContentTypeDef {
  /** Stable registry key, also stored in Content.type. */
  key: string
  /** Persian labels for the admin UI. */
  labelSingular: string
  labelPlural: string
  description?: string
  /** Lucide icon name used in admin nav. */
  icon: string
  routing: RoutingConfig
  /** Type-specific custom fields (beyond title/body/excerpt/SEO). */
  fields: FieldDef[]
  taxonomy: { categories: boolean; tags: boolean }
  publishing: { scheduling: boolean }
  relations: RelationDef[]
  navigation: TypeNavigationConfig
  seoDefaults?: { titleSuffix?: string }
  /** Columns shown in the admin list view (Content keys or field keys). */
  listColumns: string[]
  /** Capability keys — all granted to ADMIN now; structured for future roles. */
  permissions: ContentCapability[]
}

/** Build a Zod object validating the custom `fields` payload for a type. */
export function fieldsSchema(def: ContentTypeDef): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const f of def.fields) {
    let s: z.ZodTypeAny
    switch (f.type) {
      case "number":
        s = z.coerce.number()
        if (f.min !== undefined) s = (s as z.ZodNumber).min(f.min)
        if (f.max !== undefined) s = (s as z.ZodNumber).max(f.max)
        break
      case "boolean":
        s = z.coerce.boolean()
        break
      case "select":
        s = f.options?.length
          ? z.enum([f.options[0].value, ...f.options.slice(1).map((o) => o.value)] as [string, ...string[]])
          : z.string()
        break
      case "url":
        s = z.string().url().or(z.literal(""))
        break
      case "date":
        s = z.string()
        break
      default: {
        let str = z.string()
        if (f.maxLength) str = str.max(f.maxLength)
        s = str
        break
      }
    }
    shape[f.key] = f.required ? s : s.optional().nullable()
  }
  return z.object(shape).partial() as z.ZodType<Record<string, unknown>>
}
