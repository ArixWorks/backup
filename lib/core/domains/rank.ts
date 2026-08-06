/**
 * Display ordering for verified-free domain suggestions.
 *
 * Deliberately free of `server-only` and of any database or provider import so it
 * stays a pure function that can be unit tested directly under `node --test`.
 */

export interface RankableSuggestion {
  domain: string
}

/**
 * Orders free names for display: one extension per distinct label first, then the
 * remaining extensions, preferring `.com` within each pass.
 *
 * Insertion order groups every extension of a label together, so a 10-card
 * carousel could show `coffira.com`, `coffira.net`, `coffira.org` and burn three
 * slots on one idea. Interleaving surfaces more distinct names in the slots the
 * user actually sees, without discarding the alternates.
 */
export function rankAvailable<T extends RankableSuggestion>(entries: readonly T[]): T[] {
  const score = (item: T) => (item.domain.endsWith(".com") ? 0 : 1)
  const comFirst = (a: T, b: T) => score(a) - score(b)

  const byLabel = new Map<string, T[]>()
  for (const entry of entries) {
    const dot = entry.domain.indexOf(".")
    const label = dot === -1 ? entry.domain : entry.domain.slice(0, dot)
    const bucket = byLabel.get(label)
    if (bucket) bucket.push(entry)
    else byLabel.set(label, [entry])
  }
  for (const bucket of byLabel.values()) bucket.sort(comFirst)

  // Round-robin across labels so pass 1 is all-distinct, then pass 2, and so on.
  const buckets = [...byLabel.values()]
  const ranked: T[] = []
  const deepest = Math.max(0, ...buckets.map((bucket) => bucket.length))
  for (let depth = 0; depth < deepest; depth += 1) {
    const pass = buckets.map((bucket) => bucket[depth]).filter((item): item is T => Boolean(item))
    pass.sort(comFirst)
    ranked.push(...pass)
  }
  return ranked
}
