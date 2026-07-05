import "server-only"

/**
 * Public surface of the SubIO AI Platform. Every AI capability (content studio,
 * support, copilot, knowledge base, automation, translation, etc.) imports from
 * here and NEVER from the `ai` package or a provider SDK directly. This keeps
 * the whole platform provider-agnostic and centrally observable.
 */

// Core generation (provider-agnostic gateway wrapper)
export { runText, runObject, runStream } from "./client"
export type { RunOptions, RunTextResult, RunObjectResult } from "./client"

// Configuration + provider registry
export { getAiConfig, AI_SETTING_KEYS } from "./settings"
export type { AiConfig } from "./settings"
export { AI_PROVIDERS, AI_PROVIDER_IDS, getProviderDef, DEFAULT_MODEL, DEFAULT_PROVIDER } from "./providers"

// Prompts (library + versioning) and memory
export { loadPrompt, ensurePrompt, addPromptVersion, renderTemplate } from "./prompts"
export { rememberValue, recallValue, listMemories, forgetValue } from "./memory"

// Usage / cost analytics
export { getUsageSummary, getTodayTotals, recordUsage } from "./usage"

// Permissions
export { requireAiAdmin, requireSuperAdmin, isSuperAdmin } from "./permissions"

// Errors
export {
  AiDisabledError,
  AiNotConfiguredError,
  AiBudgetExceededError,
  AiProviderError,
} from "./errors"
