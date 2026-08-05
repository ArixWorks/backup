/**
 * The most-used extensions on the internet, most popular first.
 *
 * Ordered by real-world registration volume (`.com` alone is ~157M domains,
 * `.net` ~12M, `.org` ~11M, then a long tail of new gTLDs), NOT alphabetically
 * and NOT by our margin. This drives the "popular extensions" chips and the
 * globe labels, so it has to match what a visitor would actually recognise.
 *
 * The list deliberately contains extensions our registrar does not currently
 * carry (`.ir`, `.io`, `.ai`, `.tv`, `.cloud`). Ranking is looked up by name,
 * so an absent entry simply never matches - and if the catalog gains one later
 * it lands in the right place with no code change here.
 */
export const POPULAR_TLDS = [
  ".ir",
  ".com",
  ".net",
  ".org",
  ".xyz",
  ".info",
  ".co",
  ".online",
  ".shop",
  ".site",
  ".store",
  ".io",
  ".ai",
  ".live",
  ".tech",
  ".app",
  ".dev",
  ".me",
  ".biz",
  ".club",
  ".cloud",
  ".tv",
  ".space",
  ".website",
  ".pro",
  ".agency",
] as const

/**
 * Rank lookup. Built once rather than per-call because the sort below runs over
 * the whole catalog (~280 rows) on every request that lists extensions.
 */
const RANK = new Map<string, number>(POPULAR_TLDS.map((tld, index) => [tld, index]))

/**
 * `displayOrder` for a TLD, used when the sync creates a row.
 *
 * Popular extensions get 1..N so they lead the catalog. Everything else is
 * pushed past `UNRANKED_BASE`, where it is ordered alphabetically instead of
 * being left to the database's arbitrary tie order - which is exactly the bug
 * that surfaced `.zone`/`.zip`/`.yachts` as our "popular" extensions.
 */
export const UNRANKED_BASE = 1000

export function displayOrderFor(tld: string): number {
  const rank = RANK.get(tld.toLowerCase())
  return rank === undefined ? UNRANKED_BASE : rank + 1
}

/** True when the extension is one we consider globally well-known. */
export function isPopularTld(tld: string): boolean {
  return RANK.has(tld.toLowerCase())
}
