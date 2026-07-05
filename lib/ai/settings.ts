import "server-only"
import { getAllSettings, setSettings, toBool, toNumber } from "@/lib/core/settings"
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "./providers"

/**
 * Non-secret AI configuration. Stored in the generic `Setting` K/V table under
 * `ai.*` keys so it shares the existing settings cache + invalidation. Secret
 * API keys are NOT here — they live encrypted in `AiCredential`.
 *
 * Resolution order for every value: DB (admin panel) → env default → hardcoded
 * fallback. Anything saved in the panel therefore overrides `.env`.
 */

export const AI_SETTING_KEYS = {
  enabled: "ai.enabled", // master switch for the whole AI platform
  provider: "ai.provider", // provider slug from the registry
  model: "ai.model", // "provider/model" string
  embeddingModel: "ai.embeddingModel", // embedding model for the knowledge base (must be 1536-dim)
  temperature: "ai.temperature", // 0..2
  maxTokens: "ai.maxTokens", // max output tokens per call (0 = provider default)
  timeoutMs: "ai.timeoutMs", // per-call timeout
  maxRetries: "ai.maxRetries", // transient-error retries
  streaming: "ai.streaming", // allow streaming responses
  // Guardrails (0 = unlimited)
  dailyTokenLimit: "ai.dailyTokenLimit", // platform-wide tokens/day
  dailyCostLimitUsd: "ai.dailyCostLimitUsd", // platform-wide $/day
  userRatePerMin: "ai.userRatePerMin", // per-user calls/minute
} as const

export type AiSettingKey = (typeof AI_SETTING_KEYS)[keyof typeof AI_SETTING_KEYS]

/** env-backed defaults (used when a key has no DB value). */
function envDefaults(): Record<string, string> {
  return {
    [AI_SETTING_KEYS.enabled]: "true",
    [AI_SETTING_KEYS.provider]: process.env.AI_DEFAULT_PROVIDER || DEFAULT_PROVIDER,
    [AI_SETTING_KEYS.model]: process.env.AI_DEFAULT_MODEL || DEFAULT_MODEL,
    [AI_SETTING_KEYS.embeddingModel]:
      process.env.AI_EMBEDDING_MODEL || "openai/text-embedding-3-small",
    [AI_SETTING_KEYS.temperature]: process.env.AI_DEFAULT_TEMPERATURE || "0.7",
    [AI_SETTING_KEYS.maxTokens]: process.env.AI_DEFAULT_MAX_TOKENS || "0",
    [AI_SETTING_KEYS.timeoutMs]: process.env.AI_DEFAULT_TIMEOUT_MS || "60000",
    [AI_SETTING_KEYS.maxRetries]: process.env.AI_DEFAULT_MAX_RETRIES || "2",
    [AI_SETTING_KEYS.streaming]: "true",
    [AI_SETTING_KEYS.dailyTokenLimit]: process.env.AI_DAILY_TOKEN_LIMIT || "0",
    [AI_SETTING_KEYS.dailyCostLimitUsd]: process.env.AI_DAILY_COST_LIMIT_USD || "0",
    [AI_SETTING_KEYS.userRatePerMin]: process.env.AI_USER_RATE_PER_MIN || "20",
  }
}

export interface AiConfig {
  enabled: boolean
  provider: string
  model: string
  embeddingModel: string
  temperature: number
  maxTokens: number
  timeoutMs: number
  maxRetries: number
  streaming: boolean
  dailyTokenLimit: number
  dailyCostLimitUsd: number
  userRatePerMin: number
}

/** Resolve the effective AI config (DB overrides env overrides fallback). */
export async function getAiConfig(): Promise<AiConfig> {
  const all = await getAllSettings()
  const env = envDefaults()
  const get = (k: string) => (all[k] !== undefined && all[k] !== "" ? all[k] : env[k])
  return {
    enabled: toBool(get(AI_SETTING_KEYS.enabled)),
    provider: get(AI_SETTING_KEYS.provider),
    model: get(AI_SETTING_KEYS.model),
    embeddingModel: get(AI_SETTING_KEYS.embeddingModel),
    temperature: toNumber(get(AI_SETTING_KEYS.temperature), 0.7),
    maxTokens: toNumber(get(AI_SETTING_KEYS.maxTokens), 0),
    timeoutMs: toNumber(get(AI_SETTING_KEYS.timeoutMs), 60000),
    maxRetries: toNumber(get(AI_SETTING_KEYS.maxRetries), 2),
    streaming: toBool(get(AI_SETTING_KEYS.streaming)),
    dailyTokenLimit: toNumber(get(AI_SETTING_KEYS.dailyTokenLimit), 0),
    dailyCostLimitUsd: toNumber(get(AI_SETTING_KEYS.dailyCostLimitUsd), 0),
    userRatePerMin: toNumber(get(AI_SETTING_KEYS.userRatePerMin), 20),
  }
}

/**
 * Return the AI settings map for the admin panel: every `ai.*` key resolved to
 * its effective value, plus a flag showing whether each came from the DB or env
 * (so the UI can label ".env default" vs "overridden").
 */
export async function getAiSettingsForAdmin(): Promise<{
  values: Record<string, string>
  source: Record<string, "db" | "env">
}> {
  const all = await getAllSettings()
  const env = envDefaults()
  const values: Record<string, string> = {}
  const source: Record<string, "db" | "env"> = {}
  for (const key of Object.values(AI_SETTING_KEYS)) {
    const fromDb = all[key] !== undefined && all[key] !== ""
    values[key] = fromDb ? all[key] : env[key]
    source[key] = fromDb ? "db" : "env"
  }
  return { values, source }
}

/** Persist a partial map of `ai.*` settings (admin panel save). */
export async function saveAiSettings(entries: Record<string, string>): Promise<void> {
  const allowed = new Set<string>(Object.values(AI_SETTING_KEYS))
  const clean: Record<string, string> = {}
  for (const [k, v] of Object.entries(entries)) {
    if (allowed.has(k)) clean[k] = v
  }
  if (Object.keys(clean).length) await setSettings(clean)
}
