/**
 * Client-safe image constants (no "server-only", no DB imports).
 * Shared by the Copilot image panel (client) and the server-side
 * settings module. Keep this file free of any server dependencies.
 */

/** Supported aspect ratios exposed in the Copilot image panel. */
export const IMAGE_ASPECTS = ["1:1", "16:9", "4:5", "4:3", "3:4", "9:16"] as const
export type ImageAspect = (typeof IMAGE_ASPECTS)[number]

/**
 * Exact pixel size per aspect ratio.
 *
 * The default image model (`openai/gpt-image-2`) accepts arbitrary sizes as
 * long as: both edges are multiples of 16, the ratio is within 1:3–3:1, and
 * total pixels are between 655,360 and 8,294,400. So every logical aspect maps
 * to a size that EXACTLY matches its ratio — the generated image therefore
 * lands in the site's standard frame with no crop / letterboxing.
 *
 * Every value below is a true multiple of 16 and honours the requested ratio,
 * so the output dimensions are 1:1 with the storefront frames.
 */
export const ASPECT_SIZE: Record<ImageAspect, { w: number; h: number }> = {
  "1:1": { w: 1024, h: 1024 }, // 1.000
  "16:9": { w: 1536, h: 864 }, // 1.778 — matches product cover / banner / OG
  "4:3": { w: 1280, h: 960 }, // 1.333
  "4:5": { w: 1024, h: 1280 }, // 0.800 — gallery portrait
  "3:4": { w: 960, h: 1280 }, // 0.750
  "9:16": { w: 864, h: 1536 }, // 0.563
}

/**
 * A hard, model-agnostic instruction appended to every image prompt so the
 * generated image comes back at EXACTLY the site's standard dimensions for the
 * target ratio — never oversized, letterboxed, or off-ratio (which is what
 * caused images to get cropped inside the storefront frames).
 */
export function aspectDirective(aspect: ImageAspect): string {
  const { w, h } = ASPECT_SIZE[aspect]
  const orientation =
    w === h ? "perfectly square" : w > h ? "horizontal landscape" : "vertical portrait"
  return [
    `Output format: EXACTLY ${w}x${h} pixels, ${aspect} aspect ratio (${orientation}).`,
    "Do NOT add padding, borders, letterboxing, or extra canvas.",
    "Keep the main subject fully inside the frame with safe margins so nothing important is cropped at the edges.",
  ].join(" ")
}
