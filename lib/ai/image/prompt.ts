import "server-only"
import { getEntityDef } from "../copilot/entities"
import { aspectDirective, type ImageAspect } from "./constants"

/**
 * Auto-build an image prompt from entity/form context. The admin can always
 * override the generated prompt in the Copilot image panel before generating.
 * Prompts are written in English for the best cross-model image quality.
 *
 * The prompt is assembled from a consistent BRAND ART-DIRECTION template so
 * every generated product image shares the same premium look and the same
 * signature mascot — only the product and a per-product ACCENT COLOR change.
 * The mascot / scene text are editable from the AI settings panel and passed
 * in via `brand`; when omitted the built-in defaults below are used.
 */

/* ------------------------------------------------------------------ *
 * Brand art-direction defaults (editable from the AI settings panel).
 * ------------------------------------------------------------------ */

/** Signature mascot — kept identical across every image for brand recall. */
export const DEFAULT_BRAND_MASCOT =
  "Brand mascot (MUST appear in the image, drawn IDENTICALLY every time): a small, friendly futuristic robot. " +
  "Compact chibi proportions, a smooth rounded matte-black body with a soft glossy finish, a round head, " +
  "two large glowing neon-blue oval eyes as its ONLY facial feature (no mouth — all expression comes from the eyes), " +
  "a single short antenna on top, short stubby friendly arms, and slim cyan glowing accent lines tracing its body panels. " +
  "A minimal engraved letter 'S' emblem glows softly on its chest. " +
  "Personality: friendly, curious and premium — a wholly unique character in the spirit of a Portal turret, Wall-E and Baymax, but original. " +
  "The mascot playfully presents / interacts with the product. Keep its design, colors and proportions consistent across all images; only its pose changes."

/** Cinematic scene — the shared premium look behind every product. */
export const DEFAULT_BRAND_SCENE =
  "Ultra-premium 3D advertising key visual, cinematic studio product render, dark luxurious gradient background, " +
  "soft volumetric light beams, gentle rim lighting, tasteful floating bokeh light particles, a subtle reflective floor, " +
  "a sleek display podium for the product, shallow depth of field, photorealistic octane/redshift style, crisp focus, " +
  "8k detail, dramatic yet clean and uncluttered composition, high-end brand aesthetic."

export interface BrandArtDirection {
  enabled: boolean
  mascot: string
  scene: string
}

const DEFAULT_BRAND: BrandArtDirection = {
  enabled: true,
  mascot: DEFAULT_BRAND_MASCOT,
  scene: DEFAULT_BRAND_SCENE,
}

/* ------------------------------------------------------------------ *
 * Per-product accent color — same template, color varies by product.
 * ------------------------------------------------------------------ */

interface Accent {
  name: string
  hex: string
}

/** Curated accents that read as premium against a dark cinematic scene. */
const ACCENT_PALETTE: Accent[] = [
  { name: "electric cyan", hex: "#00E5FF" },
  { name: "emerald green", hex: "#22E17B" },
  { name: "royal gold / amber", hex: "#F5B301" },
  { name: "crimson red", hex: "#FF3B47" },
  { name: "sapphire blue", hex: "#3B82F6" },
  { name: "violet magenta", hex: "#B14BFF" },
  { name: "sunset orange", hex: "#FF7A18" },
  { name: "teal turquoise", hex: "#14D6C4" },
  { name: "hot rose pink", hex: "#FF4D8D" },
  { name: "lime green", hex: "#A6E22E" },
]

/**
 * Map common category / product keywords to a fitting accent so the color
 * feels intentional. Anything unmatched falls back to a deterministic hash
 * pick, so the same product always yields the same color (stable on re-gen).
 */
const CATEGORY_ACCENT: { match: RegExp; name: string }[] = [
  { match: /spotify|music|موسیقی|podcast|پادکست|آهنگ/i, name: "emerald green" },
  { match: /netflix|film|movie|stream|فیلم|سریال|ویدیو|video/i, name: "crimson red" },
  { match: /youtube|یوتیوب/i, name: "crimson red" },
  { match: /game|gaming|گیم|بازی|xbox|playstation|ps\d|steam/i, name: "violet magenta" },
  { match: /vpn|security|امنیت|proxy|فیلترشکن/i, name: "teal turquoise" },
  { match: /ai|chatgpt|هوش مصنوعی|gpt|midjourney|claude|gemini/i, name: "sapphire blue" },
  { match: /telegram|تلگرام/i, name: "sapphire blue" },
  { match: /design|طراحی|canva|figma|adobe/i, name: "sunset orange" },
  { match: /premium|طلایی|gold|vip|لاکچری|ویژه/i, name: "royal gold / amber" },
  { match: /instagram|اینستاگرام|social|شبکه اجتماعی/i, name: "hot rose pink" },
]

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

function pickAccent(seed: string): Accent {
  const s = seed.trim()
  for (const rule of CATEGORY_ACCENT) {
    if (rule.match.test(s)) {
      const found = ACCENT_PALETTE.find((a) => a.name === rule.name)
      if (found) return found
    }
  }
  if (!s) return ACCENT_PALETTE[2] // gold default
  return ACCENT_PALETTE[hashString(s) % ACCENT_PALETTE.length]
}

/* ------------------------------------------------------------------ *
 * Form helpers.
 * ------------------------------------------------------------------ */

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

/** Get a specific locale of a (possibly localized) field. */
function pickLocale(form: Record<string, unknown>, key: string, locale: "fa" | "en"): string {
  const v = form?.[key]
  if (v && typeof v === "object") {
    const rec = v as Record<string, unknown>
    if (typeof rec[locale] === "string") return rec[locale] as string
  }
  if (locale === "fa" && typeof v === "string") return v
  return ""
}

/* ------------------------------------------------------------------ *
 * Slot composition — how the mascot + product are framed per slot.
 * ------------------------------------------------------------------ */

const SLOT_COMPOSITION: Record<string, string> = {
  cover:
    "Hero composition: the product elevated on the podium as the clear focal point, the mascot standing beside it presenting it, centered, generous breathing room.",
  thumbnail:
    "Compact icon composition: the product front-and-center and dominant, the mascot small in one corner as a brand signature, minimal background, stays crisp at small sizes.",
  banner:
    "Wide cinematic banner: the mascot on one side actively presenting, the product prominent, dynamic diagonal light streaks, and ample clean negative space on the opposite side for later text overlay.",
  gallery:
    "Immersive lifestyle hero: the product shown in a realistic premium context with the mascot interacting naturally, rich detail, depth.",
  og: "Social share key visual: product centered with the mascot beside it, bold high-contrast lighting, brandable, safe margins on all edges.",
  telegram:
    "Punchy square social preview: the mascot presenting the product, vivid and eye-catching, mobile-first, strong central focus.",
  prize:
    "Celebratory giveaway reveal: the prize product elevated on a spotlight pedestal with the mascot presenting it joyfully, confetti and light particles, an exciting premium gift-reveal mood.",
}

/* ------------------------------------------------------------------ *
 * Legacy simple prompt (used only when brand art-direction is OFF).
 * ------------------------------------------------------------------ */

const SLOT_STYLE_SIMPLE: Record<string, string> = {
  cover: "clean modern product hero shot, soft studio lighting, premium e-commerce look",
  thumbnail: "centered product icon, minimal background, crisp and legible at small size",
  banner: "wide marketing banner, dynamic composition, bold focal subject, ample negative space",
  gallery: "detailed product lifestyle shot, realistic context, high detail",
  og: "social share card style, high contrast, product centered, brandable",
  telegram: "square social preview, vivid, eye-catching, mobile-first",
  prize: "attractive giveaway prize presentation, celebratory, gift theme",
}

/* ------------------------------------------------------------------ */

export function buildImagePrompt(input: {
  entityId?: string
  slot?: string
  aspect?: ImageAspect
  form?: Record<string, unknown>
  override?: string
  /** Editable brand art-direction (mascot + scene). Defaults to built-ins. */
  brand?: BrandArtDirection
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
  const brand = input.brand ?? DEFAULT_BRAND

  const title = pick(form, "title") || pick(form, "prizeLabel") || pick(form, "subject")
  const titleEn = pickLocale(form, "title", "en").trim()
  const desc = pick(form, "shortDescription") || pick(form, "description")
  const category = pick(form, "category")

  /* ---- Legacy path: brand art-direction turned off ---- */
  if (!brand.enabled) {
    const style = (input.slot && SLOT_STYLE_SIMPLE[input.slot]) || "clean professional product image"
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

  /* ---- Branded template ---- */
  const accent = pickAccent(category || titleEn || title || def?.label || "")
  const composition = (input.slot && SLOT_COMPOSITION[input.slot]) || SLOT_COMPOSITION.cover

  // English product name may appear as tasteful on-image typography — but never
  // on the tiny thumbnail (kept as a clean icon). No prices / discounts / Persian.
  const allowTitleText = titleEn.length > 0 && input.slot !== "thumbnail"

  return [
    title ? `Subject product: "${title}".` : `${def?.label ?? "product"} showcase.`,
    category ? `Product category: ${category}.` : "",
    desc ? `Product context: ${desc.slice(0, 180)}.` : "",
    brand.scene,
    brand.mascot,
    composition,
    `ACCENT COLOR THEME for this image: ${accent.name} (${accent.hex}). ` +
      `Drive the light beams, glow, rim lighting, podium edge, particles and background accents in this ${accent.name} tone so the whole scene reads in this color, ` +
      `while the mascot keeps its signature neon-blue eyes and cyan body lines.`,
    allowTitleText
      ? `Typography: you may place the product name "${titleEn}" once, in clean modern LATIN/English lettering, correctly spelled, tastefully integrated; no other words.`
      : "Render NO text at all.",
    "Strictly avoid: any Persian or Arabic text, gibberish or fake letters, prices, discount badges, percentage tags, watermarks, UI mockups, or any logo other than the mascot's 'S' emblem.",
    rule,
  ]
    .filter(Boolean)
    .join(" ")
}
