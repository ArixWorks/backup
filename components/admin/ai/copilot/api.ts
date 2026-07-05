import { apiPost, apiPut } from "@/lib/api-client"
import type {
  CopilotApplyMode,
  CopilotFormObject,
  SimilarMatch,
  ValidationResult,
} from "@/lib/ai/copilot/types"
import type { ImageAspect } from "@/lib/ai/image/settings"

const ENDPOINT = "/api/v1/admin/ai/form-copilot"

export interface GeneratedImage {
  url: string
  aspect: ImageAspect
  prompt: string
}

export interface AssetSetItem {
  slot: string
  label: string
  image: GeneratedImage | null
  error?: string
}

interface WorkflowResponse {
  form: CopilotFormObject
  similar: SimilarMatch[]
  categories: string[]
}

/** Full autofill / workflow run. */
export function copilotAutofill(input: {
  entityId: string
  brief: string
  mode: CopilotApplyMode
  improve?: boolean
  currentForm?: Record<string, unknown>
  targetFields?: string[]
}): Promise<{ data: WorkflowResponse }> {
  return apiPost(ENDPOINT, { action: "autofill", ...input })
}

/** Improve existing (edit-mode) data. */
export function copilotImprove(input: {
  entityId: string
  currentForm: Record<string, unknown>
  brief?: string
}): Promise<{ data: WorkflowResponse }> {
  return apiPost(ENDPOINT, { action: "improve", ...input })
}

/** Regenerate a single field (optionally a single locale). */
export function copilotRegenerateField(input: {
  entityId: string
  field: string
  locale?: string
  brief?: string
  currentForm?: Record<string, unknown>
}): Promise<{ data: CopilotFormObject }> {
  return apiPost(ENDPOINT, { action: "regenerate-field", ...input })
}

export function copilotDetectSimilar(input: {
  title: string
  category?: string
}): Promise<{ data: { matches: SimilarMatch[] } }> {
  return apiPost(ENDPOINT, { action: "detect-similar", ...input })
}

export function copilotValidate(input: {
  entityId: string
  form: Record<string, unknown>
}): Promise<{ data: ValidationResult }> {
  return apiPost(ENDPOINT, { action: "validate", ...input })
}

export function copilotExplain(input: {
  entityId: string
  field: string
  value: unknown
  form?: Record<string, unknown>
}): Promise<{ data: { text: string } }> {
  return apiPost(ENDPOINT, { action: "explain", ...input })
}

export function copilotGenerateImage(input: {
  entityId?: string
  slot?: string
  prompt?: string
  aspect?: ImageAspect
  folder?: string
  form?: Record<string, unknown>
  variations?: number
}): Promise<{ data: { image?: GeneratedImage; images?: GeneratedImage[] } }> {
  return apiPost(ENDPOINT, { action: "generate-image", ...input })
}

export function copilotGenerateAssetSet(input: {
  entityId?: string
  prompt?: string
  slots?: string[]
  folder?: string
  form?: Record<string, unknown>
}): Promise<{ data: { assets: AssetSetItem[] } }> {
  return apiPost(ENDPOINT, { action: "generate-asset-set", ...input })
}

/** Feedback learning — record admin edits to AI output. */
export function copilotRecordEdits(input: {
  entityId: string
  edits: { field: string; ai: string; admin: string }[]
}): Promise<{ data: { ok: boolean } }> {
  return apiPut(ENDPOINT, input)
}
