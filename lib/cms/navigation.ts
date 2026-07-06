import { prisma } from "@/lib/db"
import { getContentType } from "./registry"
import { contentHref } from "./relations"
import type { NavPlacement } from "./types"

/**
 * Dynamic site navigation. Published content flagged `navShow` surfaces in the
 * site menus with no code change — placement, order, icon, nesting and
 * breadcrumb label all come from per-content nav metadata (falling back to the
 * content type's nav defaults).
 */

export interface NavNode {
  id: string
  label: string
  href: string | null
  icon: string | null
  children: NavNode[]
}

export async function getNavTree(placement: NavPlacement, locale = "fa"): Promise<NavNode[]> {
  const rows = await prisma.content.findMany({
    where: {
      locale,
      status: "PUBLISHED",
      navShow: true,
      navPlacement: { has: placement },
    },
    orderBy: [{ navOrder: "asc" }, { title: "asc" }],
    select: {
      id: true,
      type: true,
      slug: true,
      title: true,
      navLabel: true,
      navIcon: true,
      navParentId: true,
    },
  })

  const toNode = (r: (typeof rows)[number]): NavNode => {
    const def = getContentType(r.type)
    return {
      id: r.id,
      label: r.navLabel || r.title,
      href: contentHref(r.type, r.slug),
      icon: r.navIcon || def?.navigation.defaultIcon || null,
      children: [],
    }
  }

  const nodeMap = new Map<string, NavNode>()
  for (const r of rows) nodeMap.set(r.id, toNode(r))

  const roots: NavNode[] = []
  for (const r of rows) {
    const node = nodeMap.get(r.id)!
    if (r.navParentId && nodeMap.has(r.navParentId)) {
      nodeMap.get(r.navParentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}
