import "server-only"
import { z } from "zod"
import { runObject } from "@/lib/ai/client"
import { rankAvailable } from "./rank"
import { listTlds, lookupDomainsBatch } from "@/lib/core/domains/service"
import { normalizeLabel } from "@/lib/core/domains/validation"

/** Free domains we try to hand back before stopping early. */
export const TARGET_AVAILABLE = 5
/** Hard ceiling on generate-then-verify rounds, so a bad prompt can't loop forever. */
const MAX_ROUNDS = 4
const LABELS_PER_ROUND = 7
/** Extensions tried per label. 7 labels x 3 = 21 names, one provider batch. */
const EXT_PER_LABEL = 3
/**
 * Wall-clock budget for the whole loop. Checked before each round so we return a
 * partial-but-real result instead of being killed mid-flight by the platform.
 */
const TIME_BUDGET_MS = 45_000
/** Upper bound on cards returned once the target is met. */
const MAX_RESULTS = 10

const outputSchema = z.object({
  suggestions: z
    .array(z.object({ label: z.string().min(2).max(63), reason: z.string().min(2).max(140) }))
    .min(1)
    .max(10),
})

export interface VerifiedSuggestion {
  domain: string
  reason: string
  asciiDomain: string
  status: string
  priceIrt: bigint | null
  listPriceIrt: bigint | null
  checkedAt: Date
}

/**
 * ASCII seed for the offline fallback. Everything outside `a-z0-9` is dropped, so
 * a fully Persian prompt collapses to the generic base rather than producing a
 * label that `normalizeLabel` would reject.
 */
function fallbackBase(prompt: string) {
  const ascii = prompt.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20)
  return ascii.length >= 2 ? ascii : "brand"
}

/**
 * Suffix pools, one per round. The fallback has to differ each round for the same
 * reason the model prompt does: repeating round 1's labels would re-check names we
 * already know are taken and the loop would never converge.
 */
const FALLBACK_SUFFIXES = [
  ["hub", "pro", "online", "market", "plus", "now", "go"],
  ["ly", "ify", "era", "ora", "verse", "labs", "kit"],
  ["spot", "nest", "forge", "prime", "wave", "core", "dash"],
  ["zone", "craft", "peak", "drift", "bloom", "vault", "atlas"],
]

function fallbackLabels(prompt: string, round: number) {
  const base = fallbackBase(prompt)
  const pool = FALLBACK_SUFFIXES[Math.min(round, FALLBACK_SUFFIXES.length - 1)]
  return pool.slice(0, LABELS_PER_ROUND).map((suffix) => ({
    label: `${base.slice(0, Math.max(2, 63 - suffix.length))}${suffix}`,
    reason: "نام کوتاه و مناسب برای ساخت یک برند آنلاین",
  }))
}

/**
 * One batch of candidate labels.
 *
 * Rejected labels are fed back in so the model stops re-proposing the same
 * obvious names: the first round tends to return dictionary-adjacent words like
 * `pixelora`, which for a popular niche are all long gone. Later rounds name the
 * failures explicitly and push for coined words, which is what actually moves the
 * hit rate instead of just re-rolling the same distribution.
 */
async function generateLabels(opts: {
  prompt: string
  round: number
  extensions: string[]
  rejected: string[]
  userId?: string
}) {
  const { prompt, round, extensions, rejected, userId } = opts
  const retryGuidance = rejected.length
    ? [
        ``,
        `These labels were already checked and are unavailable: ${rejected.slice(-40).join(", ")}.`,
        `Do not repeat them or propose minor variations of them (no added hyphens, digits, or single-letter edits).`,
        `Shift strategy: invent coined or blended words, use less common letter pairings, and vary the syllable count.`,
        `Being unusual matters more than being obvious - obvious names in this niche are already registered.`,
      ].join("\n")
    : ""

  try {
    const result = await runObject({
      feature: "domains.suggestions",
      userId,
      tier: "fast",
      // Climbs each round: low temperature keeps resampling the same crowded
      // names we just proved are taken.
      temperature: Math.min(1, 0.7 + round * 0.12),
      maxTokens: 600,
      schema: outputSchema,
      system:
        "You create short, brandable, ASCII domain labels. Return no extension, spaces, trademarked names, or explanations outside the schema.",
      prompt: `Business description (Persian or English): ${prompt}\nCreate ${LABELS_PER_ROUND} memorable labels for these extensions: ${extensions.join(", ")}. Reasons must be in Persian.${retryGuidance}`,
    })
    return result.object.suggestions
  } catch {
    return fallbackLabels(prompt, round)
  }
}

/**
 * Generates brand labels and returns only names verified free against the
 * registrar, retrying with fresh words until `TARGET_AVAILABLE` is reached.
 *
 * A single generate-and-check pass used to be the whole flow, so in a crowded
 * niche every card in the carousel could come back already registered. Each round
 * now feeds its failures back into the prompt, which is what actually shifts the
 * model off the obvious names rather than resampling the same crowded ones.
 */
export async function generateVerifiedSuggestions(opts: {
  prompt: string
  extensions?: string[]
  userId?: string
}) {
  const supported = (await listTlds()).map((item) => item.tld)
  const extensions = opts.extensions?.filter((item) => supported.includes(item)) ?? supported.slice(0, 5)

  const startedAt = Date.now()
  const available: VerifiedSuggestion[] = []
  const taken: VerifiedSuggestion[] = []
  const triedLabels = new Set<string>()
  const checkedDomains = new Set<string>()
  const rejectedLabels: string[] = []
  let rounds = 0

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    if (available.length >= TARGET_AVAILABLE) break
    if (Date.now() - startedAt > TIME_BUDGET_MS) break
    rounds += 1

    const labels = await generateLabels({
      prompt: opts.prompt,
      round,
      extensions,
      rejected: rejectedLabels,
      userId: opts.userId,
    })

    const candidates: { domain: string; reason: string }[] = []
    for (const item of labels) {
      let label: string
      try {
        label = normalizeLabel(item.label)
      } catch {
        // Model output is untrusted; one malformed label must not fail the request.
        continue
      }
      if (triedLabels.has(label)) continue
      triedLabels.add(label)
      for (const extension of extensions.slice(0, EXT_PER_LABEL)) {
        const domain = `${label}${extension}`
        if (checkedDomains.has(domain)) continue
        checkedDomains.add(domain)
        candidates.push({ domain, reason: item.reason })
      }
    }
    if (candidates.length === 0) continue

    const results = await lookupDomainsBatch(candidates.map((candidate) => candidate.domain))
    for (const candidate of candidates) {
      const result = results.get(candidate.domain)
      if (!result) continue
      const entry: VerifiedSuggestion = {
        domain: candidate.domain,
        reason: candidate.reason,
        asciiDomain: result.asciiDomain,
        status: result.status,
        priceIrt: result.priceIrt,
        listPriceIrt: result.listPriceIrt,
        checkedAt: result.checkedAt,
      }
      if (result.status === "AVAILABLE") available.push(entry)
      else taken.push(entry)
    }

    for (const label of triedLabels) {
      if (!available.some((item) => item.domain.startsWith(`${label}.`)) && !rejectedLabels.includes(label)) {
        rejectedLabels.push(label)
      }
    }
  }

  // Once the target is met, show only free names. Taken ones are appended purely
  // as filler when the niche is genuinely exhausted, so the carousel is never
  // empty and the user can still see what was tried.
  const suggestions =
    available.length >= TARGET_AVAILABLE
      ? rankAvailable(available).slice(0, MAX_RESULTS)
      : [...rankAvailable(available), ...taken.slice(0, Math.max(0, 8 - available.length))]

  return {
    suggestions,
    availableCount: available.length,
    rounds,
    /** True when we could not reach the target and had to fall back to filler. */
    exhausted: available.length < TARGET_AVAILABLE,
  }
}
