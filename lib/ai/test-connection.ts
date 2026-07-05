import "server-only"
import { createGateway, generateText } from "ai"
import { withTimeout } from "@/lib/core/resilience"
import { getProviderDef } from "./providers"
import { resolveApiKey, setCredentialStatus } from "./credentials"

/**
 * Test Connection for a provider. Because all traffic is routed through the
 * Vercel AI Gateway, connectivity is validated end-to-end against the real call
 * path: for "gateway" we list models with the resolved key; for any other
 * provider we send a tiny generation to one of its models through the gateway.
 *
 * Persists the outcome ("connected" | "error" | "invalid") so the admin panel
 * can show a live status badge per provider.
 */

export interface TestResult {
  ok: boolean
  status: "connected" | "error" | "invalid"
  detail: string
  latencyMs: number
  model?: string
}

export async function testConnection(provider: string, model?: string): Promise<TestResult> {
  const def = getProviderDef(provider)
  const startedAt = Date.now()
  const apiKey = (await resolveApiKey("gateway")) ?? undefined
  const gw = createGateway(apiKey ? { apiKey } : {})

  try {
    if (provider === "gateway") {
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

    const testModel = model || def?.suggestedModels[0]
    if (!testModel) {
      const result: TestResult = {
        ok: false,
        status: "error",
        detail: "مدلی برای تست مشخص نشده است",
        latencyMs: Date.now() - startedAt,
      }
      await setCredentialStatus(provider, "error", result.detail)
      return result
    }

    await withTimeout(
      20000,
      (signal) =>
        generateText({
          model: gw(testModel),
          prompt: "ping",
          maxOutputTokens: 8,
          maxRetries: 0,
          abortSignal: signal,
        }),
      "ai:test:generate",
    )
    const result: TestResult = {
      ok: true,
      status: "connected",
      detail: "اتصال با موفقیت برقرار شد",
      latencyMs: Date.now() - startedAt,
      model: testModel,
    }
    await setCredentialStatus(provider, "connected", result.detail)
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const invalid = /auth|api key|unauthor|forbidden|invalid|401|403/i.test(message)
    const status = invalid ? "invalid" : "error"
    const result: TestResult = {
      ok: false,
      status,
      detail: message.slice(0, 300),
      latencyMs: Date.now() - startedAt,
    }
    await setCredentialStatus(provider, status, result.detail)
    return result
  }
}
