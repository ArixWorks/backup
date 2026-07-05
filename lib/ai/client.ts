import "server-only"
import { createGateway, generateObject, generateText, streamText } from "ai"
import type { ModelMessage } from "ai"
import type { z } from "zod"
import { withTimeout } from "@/lib/core/resilience"
import { rateLimitBy } from "@/lib/api/rate-limit"
import { getAiConfig, type AiConfig } from "./settings"
import { resolveApiKey } from "./credentials"
import { getTodayTotals, recordUsage } from "./usage"
import { AiBudgetExceededError, AiDisabledError, AiProviderError } from "./errors"

/**
 * The single call path for EVERY AI generation across SubIO. Provider-agnostic:
 * all traffic is routed through the Vercel AI Gateway using `provider/model`
 * strings, so no code here is bound to OpenAI or any other vendor.
 *
 * Responsibilities:
 *   - Resolve effective config (admin panel → env → fallback).
 *   - Enforce the master switch, daily token/cost guardrails and per-user rate.
 *   - Bound every call with a timeout; the SDK handles transient retries.
 *   - Record a usage/cost/latency event for every call (success or failure).
 *
 * Feature code should call `runText` / `runObject` / `runStream` and never talk
 * to the `ai` package directly.
 */

/** Build a Gateway provider bound to the resolved key (or env/OIDC fallback). */
async function gatewayProvider() {
  const apiKey = (await resolveApiKey("gateway")) ?? undefined
  return createGateway(apiKey ? { apiKey } : {})
}

export interface RunOptions {
  /** Logical capability, e.g. "content.seo" — drives analytics + rate scoping. */
  feature: string
  system?: string
  prompt?: string
  messages?: ModelMessage[]
  /** Override the configured model for this call (still a gateway string). */
  model?: string
  temperature?: number
  maxTokens?: number
  /** Actor for per-user rate limiting + analytics. */
  userId?: string | null
  refType?: string | null
  refId?: string | null
  meta?: Record<string, unknown>
}

async function preflight(feature: string, userId?: string | null): Promise<AiConfig> {
  const config = await getAiConfig()
  if (!config.enabled) throw new AiDisabledError()

  // Daily platform-wide guardrails.
  if (config.dailyTokenLimit > 0 || config.dailyCostLimitUsd > 0) {
    const totals = await getTodayTotals()
    if (config.dailyTokenLimit > 0 && totals.tokens >= config.dailyTokenLimit) {
      throw new AiBudgetExceededError()
    }
    if (config.dailyCostLimitUsd > 0 && totals.costUsd >= config.dailyCostLimitUsd) {
      throw new AiBudgetExceededError()
    }
  }

  // Per-user rate limit (fails soft on cache outage).
  if (userId && config.userRatePerMin > 0) {
    await rateLimitBy(userId, {
      bucket: `ai:${feature}`,
      limit: config.userRatePerMin,
      windowSec: 60,
      message: "درخواست‌های هوش مصنوعی شما بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.",
    })
  }
  return config
}

function callParams(config: AiConfig, opts: RunOptions) {
  return {
    model: opts.model || config.model,
    temperature: opts.temperature ?? config.temperature,
    maxOutputTokens: (opts.maxTokens ?? config.maxTokens) || undefined,
    maxRetries: config.maxRetries,
  }
}

/**
 * The AI SDK prompt input is a discriminated union: provide EITHER `messages`
 * OR `prompt`, never both. Return the exclusive shape so the call sites type-check.
 */
function promptPayload(opts: RunOptions): { messages: ModelMessage[] } | { prompt: string } {
  if (opts.messages && opts.messages.length > 0) return { messages: opts.messages }
  return { prompt: opts.prompt ?? "" }
}

export interface RunTextResult {
  text: string
  model: string
  usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number }
}

/** Plain text generation. */
export async function runText(opts: RunOptions): Promise<RunTextResult> {
  const config = await preflight(opts.feature, opts.userId)
  const gw = await gatewayProvider()
  const p = callParams(config, opts)
  const startedAt = Date.now()
  try {
    const res = await withTimeout(
      config.timeoutMs,
      (signal) =>
        generateText({
          model: gw(p.model),
          system: opts.system,
          ...promptPayload(opts),
          temperature: p.temperature,
          maxOutputTokens: p.maxOutputTokens,
          maxRetries: p.maxRetries,
          abortSignal: signal,
        }),
      `ai:${opts.feature}`,
    )
    await recordUsage({
      feature: opts.feature,
      provider: config.provider,
      model: p.model,
      operation: "generateText",
      userId: opts.userId,
      refType: opts.refType,
      refId: opts.refId,
      inputTokens: res.usage.inputTokens,
      outputTokens: res.usage.outputTokens,
      totalTokens: res.usage.totalTokens,
      latencyMs: Date.now() - startedAt,
      ok: true,
      meta: opts.meta as never,
    })
    return { text: res.text, model: p.model, usage: res.usage }
  } catch (err) {
    await recordFailure(opts, config.provider, p.model, "generateText", startedAt, err)
    throw new AiProviderError()
  }
}

export interface RunObjectResult<T> {
  object: T
  model: string
  usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number }
}

/** Structured output validated against a Zod schema (JSON Schema under the hood). */
export async function runObject<T>(
  opts: RunOptions & { schema: z.ZodType<T> },
): Promise<RunObjectResult<T>> {
  const config = await preflight(opts.feature, opts.userId)
  const gw = await gatewayProvider()
  const p = callParams(config, opts)
  const startedAt = Date.now()
  try {
    const res = await withTimeout(
      config.timeoutMs,
      (signal) =>
        generateObject({
          model: gw(p.model),
          schema: opts.schema,
          system: opts.system,
          ...promptPayload(opts),
          temperature: p.temperature,
          maxOutputTokens: p.maxOutputTokens,
          maxRetries: p.maxRetries,
          abortSignal: signal,
        }),
      `ai:${opts.feature}`,
    )
    await recordUsage({
      feature: opts.feature,
      provider: config.provider,
      model: p.model,
      operation: "generateObject",
      userId: opts.userId,
      refType: opts.refType,
      refId: opts.refId,
      inputTokens: res.usage.inputTokens,
      outputTokens: res.usage.outputTokens,
      totalTokens: res.usage.totalTokens,
      latencyMs: Date.now() - startedAt,
      ok: true,
      meta: opts.meta as never,
    })
    return { object: res.object as T, model: p.model, usage: res.usage }
  } catch (err) {
    await recordFailure(opts, config.provider, p.model, "generateObject", startedAt, err)
    throw new AiProviderError()
  }
}

/**
 * Streaming text generation. Returns the AI SDK stream result so the caller can
 * pipe it to an HTTP response. Usage is recorded on finish. Honors the master
 * switch + guardrails via preflight.
 */
export async function runStream(opts: RunOptions) {
  const config = await preflight(opts.feature, opts.userId)
  if (!config.streaming) {
    // Streaming disabled by admin — degrade to a buffered response.
    const res = await runText(opts)
    return { text: res.text, streamed: false as const }
  }
  const gw = await gatewayProvider()
  const p = callParams(config, opts)
  const startedAt = Date.now()
  const result = streamText({
    model: gw(p.model),
    system: opts.system,
    ...promptPayload(opts),
    temperature: p.temperature,
    maxOutputTokens: p.maxOutputTokens,
    maxRetries: p.maxRetries,
    onFinish: (event) => {
      void recordUsage({
        feature: opts.feature,
        provider: config.provider,
        model: p.model,
        operation: "stream",
        userId: opts.userId,
        refType: opts.refType,
        refId: opts.refId,
        inputTokens: event.usage?.inputTokens,
        outputTokens: event.usage?.outputTokens,
        totalTokens: event.usage?.totalTokens,
        latencyMs: Date.now() - startedAt,
        ok: true,
        meta: opts.meta as never,
      })
    },
    onError: (event) => {
      void recordFailure(opts, config.provider, p.model, "stream", startedAt, event.error)
    },
  })
  return { result, streamed: true as const }
}

async function recordFailure(
  opts: RunOptions,
  provider: string,
  model: string,
  operation: string,
  startedAt: number,
  err: unknown,
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err)
  console.log(`[v0] AI ${operation} failed (${opts.feature}):`, message)
  await recordUsage({
    feature: opts.feature,
    provider,
    model,
    operation,
    userId: opts.userId,
    refType: opts.refType,
    refId: opts.refId,
    latencyMs: Date.now() - startedAt,
    ok: false,
    errorMessage: message.slice(0, 500),
    meta: opts.meta as never,
  })
}
