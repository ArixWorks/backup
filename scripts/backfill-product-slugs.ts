/**
 * Backfill readable, SEO-friendly slugs for products (and their auctions) that
 * still carry the old unguessable random slug (`p-<token>` from secureSlug).
 *
 * Safe to re-run: only rows whose slug matches the legacy random pattern are
 * touched, and `generateProductSlug` guarantees uniqueness (ignoring the row's
 * own id). Products already migrated — or any slug an admin set by hand — are
 * left untouched.
 *
 * Run:
 *   node --require ./scripts/_stub-server-only.cjs --import tsx \
 *     scripts/backfill-product-slugs.ts
 */
import { prisma } from "../lib/db"
import { generateProductSlug } from "../lib/core/slug"

/** Legacy secureSlug("p") output: "p-" + a base64url token. */
const LEGACY_SLUG = /^p-[A-Za-z0-9_-]{12,}$/
/** Weak deterministic fallback slug ("product-<token>") from a prior run where
 *  the AI was unavailable — worth regenerating now that the AI is reachable. */
const WEAK_FALLBACK = /^product(-[a-z0-9]{4,8})?$/

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, slug: true, title: true, category: true, tags: true, saleMode: true },
    orderBy: { createdAt: "asc" },
  })

  const stale = products.filter((p) => LEGACY_SLUG.test(p.slug) || WEAK_FALLBACK.test(p.slug))
  console.log(`[backfill] ${products.length} products, ${stale.length} needing readable slugs`)

  let done = 0
  for (const p of stale) {
    const next = await generateProductSlug(
      { title: p.title, category: p.category, tags: p.tags },
      { ignoreProductId: p.id },
    )
    if (next === p.slug) continue
    await prisma.product.update({ where: { id: p.id }, data: { slug: next } })
    done += 1
    console.log(`[backfill] ${p.saleMode} ${p.slug} -> ${next}  (${p.title})`)
  }

  console.log(`[backfill] updated ${done} product slug(s)`)
}

main()
  .catch((err) => {
    console.error("[backfill] failed:", err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
