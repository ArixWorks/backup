import "server-only"
import { generateFormObject, improveFormObject, type AutofillContext } from "./autofill"
import { detectSimilarProducts, listExistingCategories, referencePrices } from "./similarity"
import { getEntityDef } from "./entities"
import type { CopilotApplyMode, CopilotFormObject, SimilarMatch } from "./types"

/**
 * Copilot workflow orchestrator. Runs the context-gathering steps
 * (similar detection → categories → reference prices) before the single
 * form-generation call, so the model gets rich grounding. The client renders
 * each step's progress; this server helper returns the assembled result.
 */

export interface WorkflowInput {
  entityId: string
  brief: string
  mode: CopilotApplyMode
  improve?: boolean
  currentForm?: Record<string, unknown>
  targetFields?: string[]
  userId?: string | null
}

export interface WorkflowResult {
  form: CopilotFormObject
  similar: SimilarMatch[]
  categories: string[]
}

export async function runCopilotWorkflow(input: WorkflowInput): Promise<WorkflowResult> {
  const def = getEntityDef(input.entityId)
  if (!def) throw new Error(`Unknown copilot entity: ${input.entityId}`)

  const context: AutofillContext = {
    currentForm: input.currentForm,
    targetFields: input.targetFields,
  }

  let similar: SimilarMatch[] = []
  let categories: string[] = []

  if (def.detectSimilar) {
    // Grounding: existing catalog signals.
    const seedTitle =
      input.brief ||
      (typeof input.currentForm?.title === "string" ? (input.currentForm.title as string) : "")
    const [cats, sim] = await Promise.all([
      listExistingCategories(),
      seedTitle ? detectSimilarProducts({ title: seedTitle }) : Promise.resolve([]),
    ])
    categories = cats
    similar = sim
    context.existingCategories = cats
    const prices = await referencePrices()
    context.similarItems = similar.map((s, i) => ({
      title: s.title,
      category: s.category,
      price: prices[i] ?? null,
    }))
  }

  const form = input.improve
    ? await improveFormObject({ ...input, context })
    : await generateFormObject({ ...input, context })

  return { form, similar, categories }
}
