import "server-only"
import { prisma } from "@/lib/db"
import { runText } from "@/lib/ai/client"

/** Max length of a generated slug (keeps URLs short and readable). */
const SLUG_MAX = 60

/**
 * Normalize any string into a URL-safe, ASCII kebab-case slug. Strips
 * diacritics and drops non-ASCII characters (so a Persian-only title yields an
 * empty string — callers must provide a fallback). Never returns a leading or
 * trailing hyphen.
 */
export function slugify(input: string): string {
  return (input || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "")
}

/**
 * Ask the site's provider-agnostic AI core for a concise English SEO slug from
 * a (often Persian) product title + category + tags. Uses plain text generation
 * (more universally supported across gateway models than structured output) on
 * the low-latency "fast" tier, then normalizes the result. Returns a slug, or
 * null if AI is disabled/unavailable/empty so the caller can fall back
 * deterministically — product creation must never depend on AI uptime.
 */
async function aiSlug(parts: SlugParts): Promise<string | null> {
  try {
    const { text } = await runText({
      feature: "catalog.slug",
      tier: "fast",
      temperature: 0.2,
      maxTokens: 24,
      system:
        "You generate a single short, SEO-friendly URL slug for a digital-goods store. " +
        "Reply with ONLY the slug and nothing else — no quotes, no explanation, no code block. " +
        "Format: lowercase English a-z/0-9 words joined by hyphens, 2 to 5 words, capturing " +
        "product type, brand and plan/duration. Translate/transliterate Persian to English. " +
        "Examples: chatgpt-plus-1month, nordvpn-premium-1year, spotify-family-3months.",
      prompt: `Title: ${parts.title}\nCategory: ${parts.category ?? "-"}\nTags: ${(parts.tags ?? []).join(", ") || "-"}\n\nSlug:`,
    })
    // Take the first token-ish line and normalize; guards against stray prose.
    const firstLine = (text || "").trim().split(/\s+/)[0] ?? ""
    return slugify(firstLine) || null
  } catch {
    return null
  }
}

/** Short random suffix for disambiguation / last-resort bases. */
function shortToken(): string {
  return Math.random().toString(36).slice(2, 8)
}

/**
 * Ensure the slug is unique across Product.slug, appending -2, -3, ... until
 * free. `ignoreProductId` lets an existing product keep its own slug during a
 * backfill without colliding with itself.
 */
async function ensureUnique(base: string, ignoreProductId?: string): Promise<string> {
  const root = base || `product-${shortToken()}`
  let candidate = root
  let n = 1
  while (true) {
    const existing = await prisma.product.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
    if (!existing || existing.id === ignoreProductId) return candidate
    n += 1
    candidate = `${root}-${n}`.slice(0, SLUG_MAX).replace(/-+$/g, "")
  }
}

export interface SlugParts {
  title: string
  category?: string | null
  tags?: string[]
}

/**
 * Produce a human/SEO-friendly UNIQUE product slug. Resolution order:
 *   1. AI core (English, brand + plan aware).
 *   2. Deterministic transliteration of the title.
 *   3. Category-anchored short random token (Persian-only titles with AI down).
 * Never throws.
 */
export async function generateProductSlug(
  parts: SlugParts,
  opts: { ignoreProductId?: string } = {},
): Promise<string> {
  let base = await aiSlug(parts)
  if (!base) base = slugify(parts.title)
  if (!base) base = `${slugify(parts.category ?? "") || "product"}-${shortToken()}`
  return ensureUnique(base, opts.ignoreProductId)
}
