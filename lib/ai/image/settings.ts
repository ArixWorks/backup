import "server-only"
import { getAllSettings, setSettings } from "@/lib/core/settings"

/**
 * Image-generation configuration. Stored in the same `Setting` K/V table under
 * `ai.image.*` keys, resolved as DB (admin panel) → env → fallback — mirroring
 * the text-model settings. Provider-agnostic: the `provider` slug selects the
 * engine and everything else is model-level tuning.
 */

export const IMAGE_SETTING_KEYS = {
  provider: "ai.image.provider", // engine slug (default "gateway")
  model: "ai.image.model", // gateway image model id
} as const

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

export interface ImageConfig {
  provider: string
  model: string
}

function envDefaults(): Record<string, string> {
  return {
    [IMAGE_SETTING_KEYS.provider]: process.env.AI_IMAGE_PROVIDER || "gateway",
    // A widely-available Gateway image model. Fully overridable from the panel.
    [IMAGE_SETTING_KEYS.model]: process.env.AI_IMAGE_MODEL || "openai/gpt-image-1",
  }
}

export async function getImageConfig(): Promise<ImageConfig> {
  const all = await getAllSettings()
  const env = envDefaults()
  const get = (k: string) => (all[k] !== undefined && all[k] !== "" ? all[k] : env[k])
  return {
    provider: get(IMAGE_SETTING_KEYS.provider),
    model: get(IMAGE_SETTING_KEYS.model),
  }
}

export async function saveImageSettings(entries: Record<string, string>): Promise<void> {
  const allowed = new Set<string>(Object.values(IMAGE_SETTING_KEYS))
  const clean: Record<string, string> = {}
  for (const [k, v] of Object.entries(entries)) {
    if (allowed.has(k)) clean[k] = v
  }
  if (Object.keys(clean).length) await setSettings(clean)
}
