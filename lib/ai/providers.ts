/**
 * Provider registry — the single source of truth for every AI provider the
 * platform can talk to. Everything is routed through the Vercel AI Gateway
 * (provider-agnostic), so adding a provider here never requires new SDK
 * packages or code changes elsewhere.
 *
 * Each provider declares the env var that holds its *default* API key. The
 * effective key is resolved at runtime as: DB (admin panel) override → env.
 */

export interface AiProviderDef {
  /** Stable slug used everywhere (settings, credentials, usage rows). */
  id: string
  /** Human label (fa). */
  label: string
  /** Env var checked as the default key when no DB credential is set. */
  envKey: string
  /** A few known model ids to suggest in the UI (free-form, not exhaustive). */
  suggestedModels: string[]
  /** Whether this provider is reachable zero-config via the Gateway/OIDC. */
  gatewayZeroConfig: boolean
}

/**
 * NOTE: model ids are only *suggestions* for the admin UI. The admin can type
 * any `provider/model` string the Gateway supports — nothing is hardcoded in
 * the call path.
 */
export const AI_PROVIDERS: AiProviderDef[] = [
  {
    id: "gateway",
    label: "Vercel AI Gateway",
    envKey: "AI_GATEWAY_API_KEY",
    suggestedModels: ["openai/gpt-5.2", "anthropic/claude-sonnet-4.5", "google/gemini-3-pro-preview"],
    gatewayZeroConfig: true,
  },
  {
    id: "openai",
    label: "OpenAI",
    envKey: "OPENAI_API_KEY",
    suggestedModels: ["openai/gpt-5.2", "openai/gpt-5.1-instant", "openai/gpt-4.1", "openai/gpt-4o-mini"],
    gatewayZeroConfig: true,
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    envKey: "ANTHROPIC_API_KEY",
    suggestedModels: ["anthropic/claude-opus-4.5", "anthropic/claude-sonnet-4.5", "anthropic/claude-haiku-4.5"],
    gatewayZeroConfig: true,
  },
  {
    id: "google",
    label: "Google Gemini",
    envKey: "GOOGLE_GENERATIVE_AI_API_KEY",
    suggestedModels: ["google/gemini-3-pro-preview", "google/gemini-3-flash", "google/gemini-2.5-flash"],
    gatewayZeroConfig: true,
  },
  {
    id: "xai",
    label: "xAI (Grok)",
    envKey: "XAI_API_KEY",
    suggestedModels: ["xai/grok-4", "xai/grok-3", "xai/grok-3-mini"],
    gatewayZeroConfig: false,
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    envKey: "OPENROUTER_API_KEY",
    suggestedModels: ["openai/gpt-5.2", "anthropic/claude-sonnet-4.5"],
    gatewayZeroConfig: false,
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    envKey: "DEEPSEEK_API_KEY",
    suggestedModels: ["deepseek/deepseek-v3.2", "deepseek/deepseek-r1"],
    gatewayZeroConfig: false,
  },
  {
    id: "mistral",
    label: "Mistral",
    envKey: "MISTRAL_API_KEY",
    suggestedModels: ["mistral/mistral-large-3", "mistral/mistral-medium-3.5", "mistral/ministral-8b"],
    gatewayZeroConfig: false,
  },
]

export const AI_PROVIDER_IDS = AI_PROVIDERS.map((p) => p.id)

export function getProviderDef(id: string): AiProviderDef | undefined {
  return AI_PROVIDERS.find((p) => p.id === id)
}

export const DEFAULT_PROVIDER = "gateway"
/**
 * Requested project default. `openai/gpt-5.5` is not yet available on the
 * Gateway, so we ship `openai/gpt-5.2` (current flagship). Fully overridable
 * from env (`AI_DEFAULT_MODEL`) or the admin AI Settings panel.
 */
export const DEFAULT_MODEL = "openai/gpt-5.2"
