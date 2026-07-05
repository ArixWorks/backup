/**
 * Approximate cost estimation. Prices are USD per 1M tokens and are only used
 * for the admin cost analytics dashboard — they are an *estimate*, not billing.
 * Update freely; unknown models fall back to a conservative default.
 *
 * Keyed by the `provider/model` string (matched exactly, then by prefix).
 */

interface ModelPrice {
  inputPerM: number // USD per 1M input tokens
  outputPerM: number // USD per 1M output tokens
}

const PRICES: Record<string, ModelPrice> = {
  "openai/gpt-5.2": { inputPerM: 1.25, outputPerM: 10 },
  "openai/gpt-5": { inputPerM: 1.25, outputPerM: 10 },
  "openai/gpt-5-mini": { inputPerM: 0.25, outputPerM: 2 },
  "openai/gpt-4.1": { inputPerM: 2, outputPerM: 8 },
  "openai/gpt-4o": { inputPerM: 2.5, outputPerM: 10 },
  "openai/gpt-4o-mini": { inputPerM: 0.15, outputPerM: 0.6 },
  "anthropic/claude-opus-4.5": { inputPerM: 5, outputPerM: 25 },
  "anthropic/claude-sonnet-4.5": { inputPerM: 3, outputPerM: 15 },
  "anthropic/claude-haiku-4.5": { inputPerM: 1, outputPerM: 5 },
  "google/gemini-3-pro-preview": { inputPerM: 2, outputPerM: 12 },
  "google/gemini-3-flash": { inputPerM: 0.3, outputPerM: 2.5 },
  "google/gemini-2.5-flash": { inputPerM: 0.3, outputPerM: 2.5 },
  "deepseek/deepseek-v3.2": { inputPerM: 0.28, outputPerM: 0.42 },
  "mistral/mistral-large-3": { inputPerM: 2, outputPerM: 6 },
}

const FALLBACK: ModelPrice = { inputPerM: 1, outputPerM: 4 }

function priceFor(model: string): ModelPrice {
  if (PRICES[model]) return PRICES[model]
  const hit = Object.keys(PRICES).find((k) => model.startsWith(k))
  return hit ? PRICES[hit] : FALLBACK
}

/** Estimated cost in micro-USD (millionths of a dollar) for a call. */
export function estimateCostMicroUsd(
  model: string,
  inputTokens = 0,
  outputTokens = 0,
): bigint {
  const p = priceFor(model)
  const usd = (inputTokens / 1_000_000) * p.inputPerM + (outputTokens / 1_000_000) * p.outputPerM
  return BigInt(Math.round(usd * 1_000_000))
}

export function microUsdToUsd(micro: bigint | number): number {
  return Number(micro) / 1_000_000
}
