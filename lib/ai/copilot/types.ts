import type { CopilotLocale } from "./entities"

/**
 * Shared Copilot contract types — imported by both the API route (server) and
 * the UI components (client). Kept free of `server-only` so the client can type
 * its state against the exact same shapes the server returns.
 */

/** A localized value: one string per supported locale. */
export type LocalizedValue = Partial<Record<CopilotLocale, string>>

/** SEO block, itself localized at the container level. */
export interface SeoValue {
  metaTitle: string
  metaDescription: string
  keywords: string[]
}

/** A single generated field: its value plus an optional AI reason (Explain). */
export interface CopilotFieldValue {
  /** string | number | string[] | LocalizedValue | SeoValue-per-locale. */
  value: unknown
  /** Short human explanation for important suggestions (Explain Decision). */
  reason?: string
}

export type CopilotApplyMode = "fill-missing" | "patch" | "replace"

/** The structured object the AI produces for a whole form. */
export interface CopilotFormObject {
  /** field key → generated value (+ reason). */
  fields: Record<string, CopilotFieldValue>
  /** product only: recommended sale type with a reason. */
  recommendedSaleType?: { value: "FIXED_PRICE" | "AUCTION" | "GIVEAWAY"; reason: string }
  /** free-form image prompts keyed by slot, so the admin can edit before gen. */
  imagePrompts?: Record<string, string>
  /** overall short summary of what the AI produced. */
  summary?: string
}

export interface SimilarMatch {
  id: string
  title: string
  category?: string | null
  score: number
  /** AI/heuristic recommendation. */
  recommendation: "update" | "create-new"
}

export type ValidationStatus = "ok" | "warn" | "error"

export interface ValidationItem {
  field: string
  label: string
  status: ValidationStatus
  message: string
  /** A concrete value the admin can apply with one click. */
  suggestedFix?: string
}

export interface ValidationResult {
  items: ValidationItem[]
  overall: ValidationStatus
}

/** Workflow step identifiers, in run order. */
export const WORKFLOW_STEPS = [
  "analysis",
  "similar",
  "category",
  "price",
  "form",
  "image",
  "validation",
  "preview",
  "apply",
] as const
export type WorkflowStep = (typeof WORKFLOW_STEPS)[number]

export const WORKFLOW_STEP_LABEL: Record<WorkflowStep, string> = {
  analysis: "تحلیل درخواست",
  similar: "بررسی موارد مشابه",
  category: "پیشنهاد دسته‌بندی",
  price: "پیشنهاد قیمت",
  form: "تولید فرم",
  image: "تولید تصویر",
  validation: "اعتبارسنجی",
  preview: "پیش‌نمایش",
  apply: "اعمال",
}
