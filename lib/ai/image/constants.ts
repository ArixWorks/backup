/**
 * Client-safe image constants (no "server-only", no DB imports).
 * Shared by the Copilot image panel (client) and the server-side
 * settings module. Keep this file free of any server dependencies.
 */

/** Supported aspect ratios exposed in the Copilot image panel. */
export const IMAGE_ASPECTS = ["1:1", "16:9", "4:5", "4:3", "3:4", "9:16"] as const
export type ImageAspect = (typeof IMAGE_ASPECTS)[number]

/**
 * Pixel sizes per aspect.
 *
 * IMPORTANT: the default image model (`openai/gpt-image-1`) only accepts three
 * concrete sizes — `1024x1024` (square), `1536x1024` (landscape) and
 * `1024x1536` (portrait). Sending anything else makes the model ignore the
 * request and return an off-ratio image, which then gets cropped badly in the
 * storefront frames. So every logical aspect snaps to the nearest supported
 * size by orientation. This keeps generated imagery consistent with the site's
 * standard frames instead of oversized / mis-cropped output.
 */
export const ASPECT_SIZE: Record<ImageAspect, { w: number; h: number }> = {
  "1:1": { w: 1024, h: 1024 }, // square
  "16:9": { w: 1536, h: 1024 }, // landscape
  "4:3": { w: 1536, h: 1024 }, // landscape
  "4:5": { w: 1024, h: 1536 }, // portrait
  "3:4": { w: 1024, h: 1536 }, // portrait
  "9:16": { w: 1024, h: 1536 }, // portrait
}
