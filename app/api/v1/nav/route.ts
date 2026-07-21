import { route } from "@/lib/api/handler"
import { getNavTree } from "@/lib/cms/navigation"
import type { NavPlacement } from "@/lib/cms/types"

const PLACEMENTS = new Set(["HEADER", "FOOTER", "SIDEBAR"])

/**
 * Public navigation feed. Returns the CMS-driven menu tree for a placement so
 * the storefront chrome can surface published content in its menus without any
 * code change. Read-only, unauthenticated, safe to cache briefly.
 */
export const GET = route(async (req: Request) => {
  const { searchParams } = new URL(req.url)
  const raw = (searchParams.get("placement") || "HEADER").toUpperCase()
  const placement = (PLACEMENTS.has(raw) ? raw : "HEADER") as NavPlacement
  const locale = searchParams.get("locale") || "fa"
  const tree = await getNavTree(placement, locale)
  return { tree }
})
