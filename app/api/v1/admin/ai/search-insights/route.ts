import "server-only"
import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAiAdmin } from "@/lib/ai/permissions"
import { audit } from "@/lib/core/audit"
import { getSearchInsights } from "@/lib/core/search-log"
import { backfillProductEmbeddings } from "@/lib/core/product-embeddings"

export const dynamic = "force-dynamic"

const rangeSchema = z.coerce.number().int().min(1).max(365).catch(30)

/** Aggregated search analytics for the admin insights panel. */
export const GET = route(async (req: Request) => {
  await requireAiAdmin()
  const { searchParams } = new URL(req.url)
  const rangeDays = rangeSchema.parse(searchParams.get("range") ?? 30)
  return getSearchInsights(rangeDays)
})

/**
 * Rebuild product embeddings so the "similar product" suggestions stay fresh
 * (e.g. after bulk catalog edits). Force re-embeds every product.
 */
export const POST = route(async () => {
  const admin = await requireAiAdmin()
  const result = await backfillProductEmbeddings({ force: true })
  await audit({
    actorId: admin.id,
    action: "ai.search.reindex",
    entity: "Product",
    entityId: "",
    meta: result,
  })
  return result
})
