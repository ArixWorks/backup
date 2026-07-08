import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAiAdmin } from "@/lib/ai/permissions"
import { runCopilotWorkflow } from "@/lib/ai/copilot/workflow"
import { regenerateField } from "@/lib/ai/copilot/autofill"
import { validateForm } from "@/lib/ai/copilot/validate"
import { explainDecision } from "@/lib/ai/copilot/explain"
import { detectSimilarProducts } from "@/lib/ai/copilot/similarity"
import { recordEdits } from "@/lib/ai/copilot/feedback"
import {
  generateSingleImage,
  generateVariations,
  generateAssetSet,
} from "@/lib/ai/image/manager"
import { buildImagePrompt } from "@/lib/ai/image/prompt"
import { IMAGE_ASPECTS } from "@/lib/ai/image/settings"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const jsonRecord = z.record(z.string(), z.unknown())

// One Copilot endpoint for every admin form. `action` selects the operation;
// each branch validates its own payload and routes through the shared AI core.
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("autofill"),
    entityId: z.string().min(1),
    brief: z.string().min(1),
    mode: z.enum(["fill-missing", "patch", "replace"]).default("replace"),
    improve: z.boolean().optional(),
    currentForm: jsonRecord.optional(),
    targetFields: z.array(z.string()).optional(),
  }),
  z.object({
    action: z.literal("improve"),
    entityId: z.string().min(1),
    brief: z.string().default("داده‌ی موجود را تحلیل، بهینه و تکمیل کن."),
    currentForm: jsonRecord,
  }),
  z.object({
    action: z.literal("regenerate-field"),
    entityId: z.string().min(1),
    field: z.string().min(1),
    locale: z.string().optional(),
    brief: z.string().optional(),
    currentForm: jsonRecord.optional(),
  }),
  z.object({
    action: z.literal("detect-similar"),
    title: z.string().min(1),
    category: z.string().optional(),
  }),
  z.object({
    action: z.literal("validate"),
    entityId: z.string().min(1),
    form: jsonRecord,
  }),
  z.object({
    action: z.literal("explain"),
    entityId: z.string().min(1),
    field: z.string().min(1),
    value: z.unknown(),
    form: jsonRecord.optional(),
  }),
  z.object({
    action: z.literal("generate-image"),
    prompt: z.string().optional(),
    entityId: z.string().optional(),
    form: jsonRecord.optional(),
    slot: z.string().optional(),
    aspect: z.enum(IMAGE_ASPECTS).optional(),
    folder: z.string().optional(),
    variations: z.number().int().min(1).max(4).optional(),
  }),
  z.object({
    action: z.literal("generate-asset-set"),
    prompt: z.string().optional(),
    entityId: z.string().optional(),
    form: jsonRecord.optional(),
    slots: z.array(z.string()).optional(),
    folder: z.string().optional(),
  }),
])

export const POST = route(async (req: Request) => {
  const admin = await requireAiAdmin()
  const body = schema.parse(await req.json())
  const userId = admin.id

  switch (body.action) {
    case "autofill":
      return runCopilotWorkflow({
        entityId: body.entityId,
        brief: body.brief,
        mode: body.mode,
        improve: body.improve,
        currentForm: body.currentForm,
        targetFields: body.targetFields,
        userId,
      })

    case "improve":
      return runCopilotWorkflow({
        entityId: body.entityId,
        brief: body.brief,
        mode: "replace",
        improve: true,
        currentForm: body.currentForm,
        userId,
      })

    case "regenerate-field":
      return regenerateField({
        entityId: body.entityId,
        field: body.field,
        locale: body.locale,
        brief: body.brief,
        currentForm: body.currentForm,
        userId,
      })

    case "detect-similar":
      return { matches: await detectSimilarProducts({ title: body.title, category: body.category }) }

    case "validate":
      return validateForm({ entityId: body.entityId, form: body.form, userId })

    case "explain":
      return {
        text: await explainDecision({
          entityId: body.entityId,
          field: body.field,
          value: body.value,
          form: body.form,
          userId,
        }),
      }

    case "generate-image": {
      // Route even a manual prompt through the builder so the exact-size
      // directive is always enforced.
      const prompt = buildImagePrompt({
        override: body.prompt,
        slot: body.slot,
        aspect: body.aspect,
        form: body.form,
        entityId: body.entityId,
      })
      const folder = body.folder ?? "ai-images"
      if (body.variations && body.variations > 1) {
        return {
          images: await generateVariations(
            { prompt, aspect: body.aspect, slot: body.slot, folder, userId },
            body.variations,
          ),
        }
      }
      return {
        image: await generateSingleImage({
          prompt,
          aspect: body.aspect,
          slot: body.slot,
          folder,
          userId,
        }),
      }
    }

    case "generate-asset-set": {
      // Multi-slot set: build a shared base prompt WITHOUT a size directive —
      // generateAssetSet appends the correct per-slot directive to each image.
      const prompt = buildImagePrompt({
        override: body.prompt,
        form: body.form,
        entityId: body.entityId,
        omitAspectRule: true,
      })
      return {
        assets: await generateAssetSet(
          prompt,
          { folder: body.folder ?? "ai-images", userId },
          body.slots,
        ),
      }
    }
  }
})

// Record admin edits to AI output for in-context learning (Feedback Learning).
const feedbackSchema = z.object({
  entityId: z.string().min(1),
  edits: z.array(
    z.object({
      field: z.string(),
      ai: z.string(),
      admin: z.string(),
    }),
  ),
})

export const PUT = route(async (req: Request) => {
  await requireAiAdmin()
  const body = feedbackSchema.parse(await req.json())
  await recordEdits(body.entityId, body.edits)
  return { ok: true }
})
