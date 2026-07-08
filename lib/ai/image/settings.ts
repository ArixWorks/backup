import "server-only"
import { getAllSettings, setSettings } from "@/lib/core/settings"
import { IMAGE_ASPECTS, ASPECT_SIZE, type ImageAspect } from "./constants"

// Re-export client-safe constants for existing server-side importers.
export { IMAGE_ASPECTS, ASPECT_SIZE, type ImageAspect }

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

export interface ImageConfig {
  provider: string
  model: string
}

function envDefaults(): Record<string, string> {
  return {
    [IMAGE_SETTING_KEYS.provider]: process.env.AI_IMAGE_PROVIDER || "gateway",
    // Modern OpenAI image model. Supports exact arbitrary sizes so generated
    // imagery matches the site's frames precisely. Overridable from the panel.
    [IMAGE_SETTING_KEYS.model]: process.env.AI_IMAGE_MODEL || "openai/gpt-image-2",
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
