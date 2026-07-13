import "server-only"
import { createGateway, embed, generateImage, generateText } from "ai"
import { withTimeout } from "@/lib/core/resilience"
import { getProviderDef } from "./providers"
import { resolveApiKey, setCredentialStatus } from "./credentials"

export type ModelTestCapability = "connection" | "text" | "image" | "embedding"

export interface TestResult {
  ok: boolean
  status: "connected" | "error" | "invalid"
  detail: string
  latencyMs: number
  model?: string
  sample?: string
  dimensions?: number
}

function safeMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  return raw
    .replace(/(?:api[_ -]?key|token|authorization)[=: ]+[^\s,;]+/gi, "$1=[REDACTED]")
    .slice(0, 300)
}

export async function testConnection(
  provider: string,
  model?: string,
  capability: ModelTestCapability = "connection",
): Promise<TestResult> {
  const def = getProviderDef(provider)
  const startedAt = Date.now()
  const apiKey = (await resolveApiKey("gateway")) ?? undefined
  const gw = createGateway(apiKey ? { apiKey } : {})

  try {
    if (capability === "connection") {
      const meta = await withTimeout(15000, () => gw.getAvailableModels(), "ai:test:models")
      const count = meta.models?.length ?? 0
      const result: TestResult = {
        ok: true,
        status: "connected",
        detail: `${count} مدل در دسترس است`,
        latencyMs: Date.now() - startedAt,
      }
      await setCredentialStatus(provider, "connected", result.detail)
      return result
    }

    const testModel = model?.trim() || def?.suggestedModels[0]
    if (!testModel) {
      return {
        ok: false,
        status: "error",
        detail: "مدلی برای تست مشخص نشده است",
        latencyMs: Date.now() - startedAt,
      }
    }

    if (capability === "text") {
      const response = await withTimeout(
        120000,
        (signal) =>
          generateText({
            model: gw(testModel),
            prompt: "در یک جمله کوتاه فارسی بنویس: اتصال مدل با موفقیت آزمایش شد.",
            maxOutputTokens: 64,
            maxRetries: 0,
            abortSignal: signal,
          }),
        "ai:test:text",
      )
      return {
        ok: true,
        status: "connected",
        detail: "مدل متن پاسخ معتبر داد",
        sample: response.text.trim().slice(0, 240),
        latencyMs: Date.now() - startedAt,
        model: testModel,
      }
    }

    if (capability === "image") {
      const response = await withTimeout(
        180000,
        (signal) =>
          generateImage({
            model: gw.imageModel(testModel),
            prompt: "A minimal premium product photograph of a matte black ceramic cup on a neutral studio background, no text",
            size: "1024x1024",
            maxRetries: 0,
            abortSignal: signal,
          }),
        "ai:test:image",
      )
      return {
        ok: true,
        status: "connected",
        detail: "مدل تصویر خروجی معتبر تولید کرد (فایل ذخیره نشد)",
        sample: response.image.mediaType ?? "image/png",
        latencyMs: Date.now() - startedAt,
        model: testModel,
      }
    }

    const response = await withTimeout(
      30000,
      (signal) =>
        embed({
          model: gw.textEmbeddingModel(testModel),
          value: "آزمایش اتصال مدل بردارسازی",
          maxRetries: 0,
          abortSignal: signal,
        }),
      "ai:test:embedding",
    )
    const dimensions = response.embedding.length
    if (dimensions !== 1536) {
      return {
        ok: false,
        status: "error",
        detail: `مدل پاسخ داد اما بردار ${dimensions} بعدی است؛ پایگاه دانش فعلی دقیقاً ۱۵۳۶ بعد نیاز دارد`,
        dimensions,
        latencyMs: Date.now() - startedAt,
        model: testModel,
      }
    }
    return {
      ok: true,
      status: "connected",
      detail: "مدل Embedding با ساختار پایگاه دانش سازگار است",
      dimensions,
      latencyMs: Date.now() - startedAt,
      model: testModel,
    }
  } catch (err) {
    const message = safeMessage(err)
    const invalid = /auth|api key|unauthor|forbidden|invalid|401|403/i.test(message)
    const status = invalid ? "invalid" : "error"
    await setCredentialStatus(provider, status, message)
    return {
      ok: false,
      status,
      detail: message,
      latencyMs: Date.now() - startedAt,
      model,
    }
  }
}
