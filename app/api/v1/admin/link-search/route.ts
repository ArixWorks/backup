import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { prisma } from "@/lib/db"
import type { RefType } from "@/lib/rich-content/refs"

export const dynamic = "force-dynamic"

type Hit = { type: RefType; id: string; label: string; sub?: string }

/**
 * Live internal-link search across linkable entities. Feeds the editor's
 * Internal Link Search dialog and the `[[...]]` / `#tag` autocomplete. Returns
 * the ref id the storefront route expects (slug for products/giveaways, id for
 * auctions) so `resolveRefHref` can build a stable URL later.
 */
export const GET = route(async (req: Request) => {
  await requireAdmin()
  const url = new URL(req.url)
  const q = url.searchParams.get("q")?.trim() ?? ""
  const type = url.searchParams.get("type") as RefType | null
  if (q.length < 1) return { items: [] as Hit[] }

  const take = 6
  const hits: Hit[] = []
  const want = (t: RefType) => !type || type === t

  const [products, giveaways, auctions] = await Promise.all([
    want("product")
      ? prisma.product.findMany({
          where: { title: { contains: q, mode: "insensitive" } },
          select: { slug: true, title: true },
          take,
        })
      : Promise.resolve([]),
    want("giveaway")
      ? prisma.giveaway.findMany({
          where: { title: { contains: q, mode: "insensitive" } },
          select: { slug: true, title: true },
          take,
        })
      : Promise.resolve([]),
    want("auction")
      ? prisma.auction.findMany({
          where: { product: { title: { contains: q, mode: "insensitive" } } },
          select: { id: true, product: { select: { title: true } } },
          take,
        })
      : Promise.resolve([]),
  ])

  for (const p of products) hits.push({ type: "product", id: p.slug, label: p.title })
  for (const g of giveaways) hits.push({ type: "giveaway", id: g.slug, label: g.title })
  for (const a of auctions) hits.push({ type: "auction", id: a.id, label: a.product.title, sub: "مزایده" })

  return { items: hits }
})
