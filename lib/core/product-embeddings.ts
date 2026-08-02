import "server-only"
import { prisma } from "@/lib/db"
import { embedTexts } from "@/lib/ai/client"

/**
 * Product semantic search.
 *
 * Each product carries a pgvector embedding (Product.embedding) built from its
 * title/subtitle/description/tags/category via the shared AI core (`embedTexts`,
 * text-embedding-3-small). This powers "similar product" suggestions: when a
 * store search finds no exact keyword matches (e.g. "chatgpt" while we only
 * stock Grok and other AI accounts), we surface the semantically closest
 * products instead of an empty page.
 *
 * Because Prisma can't type the `vector` column, all embedding writes and
 * similarity reads use raw SQL with a `::vector` cast and the cosine-distance
 * operator `<=>` — the same approach as the AI knowledge base.
 *
 * Every embedding routes through the AI master switch and guardrails, so if AI
 * is disabled or over budget these helpers degrade gracefully (no-op / empty
 * results) and never throw into the request path.
 */

/** Serialize a JS number[] into the pgvector text literal `[a,b,c]`. */
function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`
}

type EmbeddableProduct = {
  title: string
  subtitle: string | null
  description: string | null
  category: string | null
  tags: string[]
  i18n: unknown
}

/**
 * Compose the natural-language text we embed for a product. We lead with the
 * title (weighted by repetition), then add subtitle, category, tags and a
 * trimmed description. English copy from the i18n bundle is appended when
 * present so cross-language queries ("chatgpt" in Latin script) still match
 * Persian catalog entries.
 */
export function buildProductEmbeddingText(product: EmbeddableProduct): string {
  const parts: string[] = []
  if (product.title) parts.push(product.title, product.title)
  if (product.subtitle) parts.push(product.subtitle)
  if (product.category) parts.push(product.category)
  if (product.tags?.length) parts.push(product.tags.join(", "))
  if (product.description) parts.push(product.description.slice(0, 1000))

  // Pull English title/description out of the i18n bundle for Latin-script queries.
  const i18n = product.i18n as
    | { en?: { title?: string; shortDescription?: string; description?: string } }
    | null
    | undefined
  if (i18n?.en?.title) parts.push(i18n.en.title)
  if (i18n?.en?.shortDescription) parts.push(i18n.en.shortDescription)

  return parts.join("\n").replace(/\s+/g, " ").trim()
}

/**
 * (Re)build and persist the embedding for a single product. Returns true on
 * success. Never throws for the "AI unavailable" case — callers on the write
 * path can treat a false return as "try again later".
 */
export async function embedProduct(productId: string): Promise<boolean> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      title: true,
      subtitle: true,
      description: true,
      category: true,
      tags: true,
      i18n: true,
    },
  })
  if (!product) return false

  const text = buildProductEmbeddingText(product)
  if (!text) return false

  try {
    const [embedding] = await embedTexts([text], { feature: "catalog.embed" })
    if (!embedding) return false
    await prisma.$executeRawUnsafe(
      `UPDATE "Product" SET embedding = $1::vector, "embeddedAt" = now() WHERE id = $2`,
      toVectorLiteral(embedding),
      productId,
    )
    return true
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.log(`[v0] embedProduct failed for ${productId}:`, message)
    return false
  }
}

/**
 * Fire-and-forget embedding refresh for the create/update path. Swallows all
 * errors so catalog writes never fail because of the AI layer.
 */
export function embedProductInBackground(productId: string): void {
  void embedProduct(productId).catch((err) => {
    console.log(`[v0] background embedProduct error for ${productId}:`, err)
  })
}

export interface SimilarProductHit {
  id: string
  similarity: number
}

/**
 * Return catalog products most semantically similar to a free-text query,
 * ordered by cosine similarity. Only active, non-hidden products with an
 * embedding are considered. `excludeIds` removes products already shown as
 * exact matches. Returns [] (never throws) when AI is unavailable.
 */
export async function searchSimilarProducts(
  query: string,
  opts: { limit?: number; excludeIds?: string[]; minSimilarity?: number } = {},
): Promise<SimilarProductHit[]> {
  const q = query.trim()
  if (!q) return []
  const limit = opts.limit ?? 8
  const minSimilarity = opts.minSimilarity ?? 0.28
  const excludeIds = opts.excludeIds ?? []

  let embedding: number[] | undefined
  try {
    ;[embedding] = await embedTexts([q], { feature: "catalog.search" })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.log(`[v0] searchSimilarProducts embed failed:`, message)
    return []
  }
  if (!embedding) return []

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; similarity: number }>>(
      `SELECT id, 1 - (embedding <=> $1::vector) AS similarity
       FROM "Product"
       WHERE embedding IS NOT NULL
         AND active = true
         AND hidden = false
         AND NOT (id = ANY($2::text[]))
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      toVectorLiteral(embedding),
      excludeIds,
      limit,
    )
    return rows
      .map((r) => ({ id: r.id, similarity: Number(r.similarity) }))
      .filter((r) => r.similarity >= minSimilarity)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.log(`[v0] searchSimilarProducts query failed:`, message)
    return []
  }
}

/**
 * Batch backfill/refresh embeddings for every product missing one (or all when
 * `force`). Used by scripts/embed-products.ts. Returns counts for reporting.
 */
export async function backfillProductEmbeddings(
  opts: { force?: boolean } = {},
): Promise<{ total: number; embedded: number; failed: number }> {
  const products = await prisma.product.findMany({
    where: opts.force ? {} : { embeddedAt: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  })

  let embedded = 0
  let failed = 0
  for (const p of products) {
    const ok = await embedProduct(p.id)
    if (ok) embedded++
    else failed++
  }
  return { total: products.length, embedded, failed }
}
