/**
 * Client-safe image constants (no "server-only", no DB imports).
 * Shared by the Copilot image panel (client) and the server-side
 * settings module. Keep this file free of any server dependencies.
 */

/** Supported aspect ratios exposed in the Copilot image panel. */
export const IMAGE_ASPECTS = ["1:1", "16:9", "4:5", "4:3", "3:4", "9:16"] as const
export type ImageAspect = (typeof IMAGE_ASPECTS)[number]

/** Pixel sizes per aspect (kept within common model limits). */
export const ASPECT_SIZE: Record<ImageAspect, { w: number; h: number }> = {
  "1:1": { w: 1024, h: 1024 },
  "16:9": { w: 1536, h: 864 },
  "4:5": { w: 896, h: 1120 },
  "4:3": { w: 1152, h: 864 },
  "3:4": { w: 864, h: 1152 },
  "9:16": { w: 864, h: 1536 },
}
