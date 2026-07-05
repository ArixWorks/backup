import "server-only"
import { prisma } from "@/lib/db"
import type { SimilarMatch } from "./types"

/**
 * Similar / duplicate detection for the product Copilot. Lightweight lexical
 * similarity over existing product titles (token overlap + substring boost).
 * Avoids an extra embedding round-trip on every keystroke while still surfacing
 * near-duplicates so the admin can choose Update vs Create New.
 */

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u200c\u200f]/g, " ") // ZWNJ / RTL marks
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tokens(s: string): Set<string> {
  return new Set(normalize(s).split(" ").filter((t) => t.length > 1))
}

/** Jaccard token overlap with a substring bonus for contained titles. */
function score(a: string, b: string): number {
  const ta = tokens(a)
  const tb = tokens(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  const union = ta.size + tb.size - inter
  let s = union ? inter / union : 0
  const na = normalize(a)
  const nb = normalize(b)
  if (na && nb && (na.includes(nb) || nb.includes(na))) s = Math.max(s, 0.8)
  return s
}

export interface SimilarInput {
  title: string
  category?: string | null
  limit?: number
}

export async function detectSimilarProducts(input: SimilarInput): Promise<SimilarMatch[]> {
  const title = input.title?.trim()
  if (!title || title.length < 2) return []

  const products = await prisma.product.findMany({
    select: { id: true, title: true, category: true },
    orderBy: { createdAt: "desc" },
    take: 300,
  })

  const scored = products
    .map((p) => {
      let s = score(title, p.title)
      if (input.category && p.category && normalize(input.category) === normalize(p.category)) {
        s = Math.min(1, s + 0.1)
      }
      return { p, s }
    })
    .filter((x) => x.s >= 0.35)
    .sort((a, b) => b.s - a.s)
    .slice(0, input.limit ?? 5)

  return scored.map(({ p, s }) => ({
    id: p.id,
    title: p.title,
    category: p.category,
    score: Math.round(s * 100) / 100,
    recommendation: s >= 0.7 ? "update" : "create-new",
  }))
}

/** Distinct existing product categories, for taxonomy suggestions. */
export async function listExistingCategories(): Promise<string[]> {
  const rows = await prisma.product.findMany({
    where: { category: { not: null } },
    select: { category: true },
    distinct: ["category"],
    take: 100,
  })
  return rows.map((r) => r.category!).filter(Boolean)
}

/** Reference prices for sane price suggestions (same category if given). */
export async function referencePrices(category?: string | null): Promise<number[]> {
  const sales = await prisma.fixedSale.findMany({
    where: category ? { product: { category } } : undefined,
    select: { price: true },
    take: 50,
    orderBy: { createdAt: "desc" },
  })
  return sales.map((s) => Number(s.price)).filter((n) => Number.isFinite(n) && n > 0)
}
