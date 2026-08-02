/**
 * Backfill / refresh product embeddings for semantic store search.
 *
 * Usage:
 *   node --env-file-if-exists=/vercel/share/.env.project \
 *     --require ./scripts/_stub-server-only.cjs --import tsx scripts/embed-products.ts [--force]
 *
 * Without --force only products missing an embedding are processed; with
 * --force every product is re-embedded (e.g. after changing the embed text).
 */
import { backfillProductEmbeddings } from "../lib/core/product-embeddings"
import { prisma } from "../lib/db"

async function main() {
  const force = process.argv.includes("--force")
  console.log(`[embed-products] starting${force ? " (force re-embed all)" : ""}...`)
  const result = await backfillProductEmbeddings({ force })
  console.log(
    `[embed-products] done. total=${result.total} embedded=${result.embedded} failed=${result.failed}`,
  )
  if (result.failed > 0) {
    console.log("[embed-products] some products failed — check that the AI master switch is on and within budget.")
  }
}

main()
  .catch((err) => {
    console.error("[embed-products] fatal:", err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
