import "server-only"
import { createGateway, generateImage } from "ai"
import { put } from "@vercel/blob"
import { withTimeout } from "@/lib/core/resilience"
import { getAiConfig } from "../settings"
import { resolveApiKey } from "../credentials"
import { recordUsage } from "../usage"
import { AiDisabledError, AiProviderError } from "../errors"
import { getImageConfig, type ImageAspect, ASPECT_SIZE } from "./settings"

/**
 * Provider-agnostic image generation.
 *
 * Every image request goes through an `ImageProvider`. The default provider is
 * the Vercel AI Gateway (`gateway.imageModel(...)`), so nothing here is bound to
 * a single vendor. Swapping the engine later (fal, replicate, …) only means
 * registering another provider in `image/providers.ts` and changing the
 * `ai.imageProvider` setting — no call-site code changes.
 */

export interface GenerateImageOptions {
  prompt: string
  aspect?: ImageAspect
  /** Logical slot (cover/banner/…) — used for analytics + blob folder. */
  slot?: string
  /** Where to persist the resulting blob (public storefront imagery). */
  folder?: string
  userId?: string | null
  refType?: string | null
  refId?: string | null
}

export interface GeneratedImage {
  url: string
  aspect: ImageAspect
  prompt: string
}

export interface ImageProvider {
  id: string
  label: string
  generate(opts: GenerateImageOptions): Promise<{ base64: string; mediaType: string }>
  /** Optional capabilities — the UI hides controls a provider can't do. */
  supportsVariations?: boolean
  supportsUpscale?: boolean
}

/** Default provider: Vercel AI Gateway image model (zero-config). */
function gatewayImageProvider(model: string): ImageProvider {
  return {
    id: "gateway",
    label: "Vercel AI Gateway",
    supportsVariations: true,
    supportsUpscale: false,
    async generate(opts) {
      const apiKey = (await resolveApiKey("gateway")) ?? undefined
      const gw = createGateway(apiKey ? { apiKey } : {})
      const size = ASPECT_SIZE[opts.aspect ?? "1:1"]
      const { image } = await generateImage({
        model: gw.imageModel(model),
        prompt: opts.prompt,
        size: `${size.w}x${size.h}` as `${number}x${number}`,
      })
      return { base64: image.base64, mediaType: image.mediaType ?? "image/png" }
    },
  }
}

/** Resolve the active image provider from settings (default → gateway). */
async function resolveProvider(): Promise<ImageProvider> {
  const cfg = await getImageConfig()
  // Only the gateway provider ships today; the switch keeps the door open for
  // additional engines without touching any caller.
  switch (cfg.provider) {
    case "gateway":
    default:
      return gatewayImageProvider(cfg.model)
  }
}

/** Turn a base64 payload into a persisted public Blob URL. */
async function persist(base64: string, mediaType: string, folder: string): Promise<string> {
  const ext = mediaType.includes("png") ? "png" : mediaType.includes("webp") ? "webp" : "jpg"
  const buffer = Buffer.from(base64, "base64")
  const blob = await put(`${folder}/ai-${Date.now()}.${ext}`, buffer, {
    access: "public",
    addRandomSuffix: true,
    contentType: mediaType,
  })
  return blob.url
}

/**
 * Generate a single image and persist it to Blob. Honors the master AI switch
 * and records a usage event (success or failure) like every other AI call.
 */
export async function generateSingleImage(opts: GenerateImageOptions): Promise<GeneratedImage> {
  const aiCfg = await getAiConfig()
  if (!aiCfg.enabled) throw new AiDisabledError()
  const imgCfg = await getImageConfig()
  const provider = await resolveProvider()
  const aspect = opts.aspect ?? "1:1"
  const folder = opts.folder ?? "ai-images"
  const startedAt = Date.now()
  try {
    const { base64, mediaType } = await withTimeout(
      aiCfg.timeoutMs,
      () => provider.generate({ ...opts, aspect }),
      `ai:image.${opts.slot ?? "generate"}`,
    )
    const url = await persist(base64, mediaType, folder)
    await recordUsage({
      feature: `image.${opts.slot ?? "generate"}`,
      provider: provider.id,
      model: imgCfg.model,
      operation: "image",
      userId: opts.userId,
      refType: opts.refType,
      refId: opts.refId,
      latencyMs: Date.now() - startedAt,
      ok: true,
    })
    return { url, aspect, prompt: opts.prompt }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.log(`[v0] AI image failed (${opts.slot ?? "generate"}):`, message)
    await recordUsage({
      feature: `image.${opts.slot ?? "generate"}`,
      provider: provider.id,
      model: imgCfg.model,
      operation: "image",
      userId: opts.userId,
      refType: opts.refType,
      refId: opts.refId,
      latencyMs: Date.now() - startedAt,
      ok: false,
      errorMessage: message.slice(0, 500),
    })
    throw new AiProviderError()
  }
}

/** Generate N variations of the same prompt (best-effort parallel). */
export async function generateVariations(
  opts: GenerateImageOptions,
  count = 3,
): Promise<GeneratedImage[]> {
  const jobs = Array.from({ length: Math.min(count, 4) }, () => generateSingleImage(opts))
  const results = await Promise.allSettled(jobs)
  return results
    .filter((r): r is PromiseFulfilledResult<GeneratedImage> => r.status === "fulfilled")
    .map((r) => r.value)
}

/** Logical asset slots + their default aspect ratios for a full entity set. */
export const ASSET_SLOTS: { slot: string; aspect: ImageAspect; label: string }[] = [
  { slot: "cover", aspect: "1:1", label: "کاور" },
  { slot: "thumbnail", aspect: "1:1", label: "بندانگشتی" },
  { slot: "banner", aspect: "16:9", label: "بنر" },
  { slot: "gallery", aspect: "4:5", label: "گالری" },
  { slot: "og", aspect: "16:9", label: "Open Graph" },
  { slot: "telegram", aspect: "16:9", label: "پیش‌نمایش تلگرام" },
]

export interface AssetSetResult {
  slot: string
  label: string
  image: GeneratedImage | null
  error?: string
}

/**
 * Generate the full asset set for an entity in one call. Each slot gets its own
 * aspect ratio but shares the same visual style (same base prompt) so the set
 * stays cohesive. Best-effort: a failed slot returns `image: null` with an error.
 */
export async function generateAssetSet(
  basePrompt: string,
  opts: Omit<GenerateImageOptions, "prompt" | "aspect" | "slot">,
  slots: string[] = ASSET_SLOTS.map((s) => s.slot),
): Promise<AssetSetResult[]> {
  const targets = ASSET_SLOTS.filter((s) => slots.includes(s.slot))
  const jobs = targets.map(async (t) => {
    try {
      const image = await generateSingleImage({
        ...opts,
        prompt: `${basePrompt}\n\nComposition: ${t.label} (${t.aspect}).`,
        aspect: t.aspect,
        slot: t.slot,
      })
      return { slot: t.slot, label: t.label, image }
    } catch (err) {
      return {
        slot: t.slot,
        label: t.label,
        image: null,
        error: err instanceof Error ? err.message : "generation failed",
      }
    }
  })
  return Promise.all(jobs)
}
