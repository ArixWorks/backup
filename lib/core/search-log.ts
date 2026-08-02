import "server-only"
import type { SearchSource } from "@prisma/client"
import { prisma } from "@/lib/db"

/**
 * Store-search analytics.
 *
 * Every store search (web + Telegram mini-app) is logged so the admin
 * /admin/ai/search-insights panel can reveal what customers look for and,
 * critically, which searches return NOTHING — a direct signal of demand for
 * products not yet in the catalog.
 *
 * Logging is deliberately best-effort and fire-and-forget: a failure here must
 * never break or slow the search response. We only record real user queries
 * (non-empty, deduped by a normalized form) and cap length to keep rows small.
 */

const MAX_QUERY_LEN = 120

/** Normalize a query for grouping: trim, collapse spaces, lowercase. */
export function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLowerCase()
}

export interface LogSearchInput {
  query: string
  resultCount: number
  suggested?: boolean
  source?: SearchSource
  locale?: string
  userId?: string | null
}

/**
 * Persist a single search event. Returns immediately on invalid/empty input.
 * Callers should NOT await this in the hot path — use void logSearch(...) so a
 * slow or failing insert can't affect the user's search latency.
 */
export async function logSearch(input: LogSearchInput): Promise<void> {
  try {
    const query = (input.query ?? "").trim().slice(0, MAX_QUERY_LEN)
    if (!query) return
    const normalized = normalizeQuery(query)
    if (!normalized) return

    await prisma.searchQueryLog.create({
      data: {
        query,
        normalized,
        resultCount: Math.max(0, Math.floor(input.resultCount)),
        suggested: input.suggested ?? false,
        source: input.source ?? "WEB",
        locale: input.locale ?? "fa",
        userId: input.userId ?? null,
      },
    })
  } catch (err) {
    console.log("[v0] logSearch failed:", err instanceof Error ? err.message : String(err))
  }
}

// --- Admin insights ----------------------------------------------------------

export interface SearchTermStat {
  query: string
  count: number
  /** Average exact-match result count across occurrences (rounded). */
  avgResults: number
  /** True when the term never returned an exact match — a demand gap. */
  zeroResult: boolean
  lastSearchedAt: Date
}

export interface SearchInsights {
  rangeDays: number
  totals: {
    total: number
    unique: number
    zeroResultSearches: number
    /** Share of searches with zero exact matches, 0–100 (rounded). */
    zeroResultRate: number
    web: number
    telegram: number
  }
  /** Most frequent terms overall. */
  topTerms: SearchTermStat[]
  /** Most frequent terms that returned nothing — the priority stock list. */
  zeroResultTerms: SearchTermStat[]
}

function sinceDate(rangeDays: number): Date {
  const since = new Date()
  since.setDate(since.getDate() - rangeDays)
  return since
}

/**
 * Aggregate search logs for the admin insights panel. Groups by the normalized
 * query so casing/spacing variants collapse together, then splits out the
 * zero-result terms (searches that never found an exact catalog match) which
 * are the actionable "products to add" list.
 */
export async function getSearchInsights(rangeDays = 30): Promise<SearchInsights> {
  const since = sinceDate(rangeDays)
  const whereRange = { createdAt: { gte: since } }

  const [total, zeroResultSearches, web, telegram, grouped] = await Promise.all([
    prisma.searchQueryLog.count({ where: whereRange }),
    prisma.searchQueryLog.count({ where: { ...whereRange, resultCount: 0 } }),
    prisma.searchQueryLog.count({ where: { ...whereRange, source: "WEB" } }),
    prisma.searchQueryLog.count({ where: { ...whereRange, source: "TELEGRAM" } }),
    prisma.searchQueryLog.groupBy({
      by: ["normalized"],
      where: whereRange,
      _count: { _all: true },
      _avg: { resultCount: true },
      _max: { createdAt: true, resultCount: true },
      _min: { query: true },
      orderBy: { _count: { normalized: "desc" } },
      take: 200,
    }),
  ])

  const toStat = (g: (typeof grouped)[number]): SearchTermStat => ({
    // _min.query is a representative raw form; fall back to the normalized key.
    query: g._min.query ?? g.normalized,
    count: g._count._all,
    avgResults: Math.round(g._avg.resultCount ?? 0),
    // A term is a demand gap only if it NEVER produced an exact match (max == 0).
    zeroResult: (g._max.resultCount ?? 0) === 0,
    lastSearchedAt: g._max.createdAt ?? since,
  })

  const stats = grouped.map(toStat)
  const topTerms = stats.slice(0, 25)
  const zeroResultTerms = stats.filter((s) => s.zeroResult).slice(0, 25)

  return {
    rangeDays,
    totals: {
      total,
      unique: grouped.length,
      zeroResultSearches,
      zeroResultRate: total > 0 ? Math.round((zeroResultSearches / total) * 100) : 0,
      web,
      telegram,
    },
    topTerms,
    zeroResultTerms,
  }
}
