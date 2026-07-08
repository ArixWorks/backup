import "server-only"
import { getEntityDef } from "../copilot/entities"
import { aspectDirective, type ImageAspect } from "./constants"

/**
 * Auto-build an image prompt from entity/form context. The admin can always
 * override the generated prompt in the Copilot image panel before generating.
 * Prompts are written in English for the best cross-model image quality.
 */

function pick(form: Record<string, unknown>, key: string): string {
  const v = form?.[key]
  if (typeof v === "string") return v
  if (v && typeof v === "object") {
    // localized value — prefer fa then en.
    const rec = v as Record<string, unknown>
    if (typeof rec.fa === "string") return rec.fa
    if (typeof rec.en === "string") return rec.en
  }
  return ""
}

const SLOT_STYLE: Record<string, string> = {
  cover: "clean modern product hero shot, soft studio lighting, premium e-commerce look",
  thumbnail: "centered product icon, minimal background, crisp and legible at small size",
  banner: "wide marketing banner, dynamic composition, bold focal subject, ample negative space",
  gallery: "detailed product lifestyle shot, realistic context, high detail",
  og: "social share card style, high contrast, product centered, brandable",
  telegram: "square social preview, vivid, eye-catching, mobile-first",
  prize: "attractive giveaway prize presentation, celebratory, gift theme",
}

export function buildImagePrompt(input: {
  entityId?: string
  slot?: string
  aspect?: ImageAspect
  form?: Record<string, unknown>
  override?: string
  /**
   * Skip the exact-size directive. Used when building a shared base prompt for
   * a multi-slot asset set — each slot has its own ratio, so the per-slot
   * directive is appended later in `generateAssetSet`.
   */
  omitAspectRule?: boolean
}): string {
  const def = input.entityId ? getEntityDef(input.entityId) : undefined
  // Resolve the target aspect from the explicit value, the entity slot, else 1:1.
  const slotAspect = def?.imageSlots.find((s) => s.key === input.slot)?.aspect
  const aspect: ImageAspect = input.aspect ?? slotAspect ?? "1:1"
  const rule = input.omitAspectRule ? "" : aspectDirective(aspect)

  // Even a manual override must still honour the exact site dimensions.
  if (input.override && input.override.trim()) {
    return rule ? `${input.override.trim()}\n\n${rule}` : input.override.trim()
  }

  const form = input.form ?? {}
  const title = pick(form, "title") || pick(form, "prizeLabel") || pick(form, "subject")
  const desc = pick(form, "shortDescription") || pick(form, "description")
  const category = pick(form, "category")
  const style = (input.slot && SLOT_STYLE[input.slot]) || "clean professional product image"

  return [
    title ? `Product: ${title}.` : `${def?.label ?? "product"} image.`,
    category ? `Category: ${category}.` : "",
    desc ? `Context: ${desc.slice(0, 200)}.` : "",
    `Style: ${style}.`,
    "No text, no watermark, high quality, professional.",
    rule,
  ]
    .filter(Boolean)
    .join(" ")
}
