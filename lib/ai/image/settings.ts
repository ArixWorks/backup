import "server-only"
import { getAllSettings, setSettings } from "@/lib/core/settings"
import { IMAGE_ASPECTS, ASPECT_SIZE, type ImageAspect } from "./constants"
import {
  DEFAULT_BRAND_MASCOT,
  DEFAULT_BRAND_SCENE,
  type BrandArtDirection,
} from "./prompt"

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
  brandEnabled: "ai.image.brandEnabled", // use the branded art-direction template
  brandMascot: "ai.image.brandMascot", // editable mascot description
  brandScene: "ai.image.brandScene", // editable cinematic scene description
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
    [IMAGE_SETTING_KEYS.brandEnabled]: "true",
    [IMAGE_SETTING_KEYS.brandMascot]: DEFAULT_BRAND_MASCOT,
    [IMAGE_SETTING_KEYS.brandScene]: DEFAULT_BRAND_SCENE,
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

/**
 * Resolve the brand art-direction (mascot + scene + enabled) for the image
 * prompt builder. DB (admin panel) → env → built-in default.
 */
export async function getBrandArtDirection(): Promise<BrandArtDirection> {
  const all = await getAllSettings()
  const env = envDefaults()
  const get = (k: string) => (all[k] !== undefined && all[k] !== "" ? all[k] : env[k])
  return {
    enabled: get(IMAGE_SETTING_KEYS.brandEnabled) !== "false",
    mascot: get(IMAGE_SETTING_KEYS.brandMascot) || DEFAULT_BRAND_MASCOT,
    scene: get(IMAGE_SETTING_KEYS.brandScene) || DEFAULT_BRAND_SCENE,
  }
}

export async function getImageSettingsForAdmin(): Promise<{
  values: Record<string, string>
  source: Record<string, "db" | "env">
}> {
  const all = await getAllSettings()
  const env = envDefaults()
  const values: Record<string, string> = {}
  const source: Record<string, "db" | "env"> = {}
  for (const key of Object.values(IMAGE_SETTING_KEYS)) {
    const fromDb = all[key] !== undefined && all[key] !== ""
    values[key] = fromDb ? all[key] : env[key]
    source[key] = fromDb ? "db" : "env"
  }
  return { values, source }
}

export async function saveImageSettings(entries: Record<string, string>): Promise<void> {
  const allowed = new Set<string>(Object.values(IMAGE_SETTING_KEYS))
  const clean: Record<string, string> = {}
  for (const [k, v] of Object.entries(entries)) {
    if (allowed.has(k)) clean[k] = v
  }
  if (Object.keys(clean).length) await setSettings(clean)
}
