import type { Metadata } from "next"
import { getContentType } from "./registry"
import { getContentBySlug, getSingleton, listContent } from "./content"
import { resolveRelations, type ResolvedTarget } from "./relations"

/**
 * Public-facing read helpers. These only ever surface PUBLISHED content and are
 * safe to call from public (unauthenticated) route segments. Business logic and
 * admin gating live elsewhere; this module is deliberately read-only.
 */

export async function listPublished(type: string, opts?: { categoryId?: string; page?: number; pageSize?: number }) {
  return listContent({
    type,
    publicOnly: true,
    categoryId: opts?.categoryId,
    page: opts?.page,
    pageSize: opts?.pageSize ?? 24,
  })
}

export async function getPublishedBySlug(type: string, slug: string) {
  return getContentBySlug(type, slug, { publicOnly: true })
}

export async function getPublishedSingleton(type: string) {
  return getSingleton(type, { publicOnly: true })
}

/** Resolve a content item's outgoing relations into display-ready targets. */
export async function getRelatedFor(contentId: string): Promise<Record<string, ResolvedTarget[]>> {
  return resolveRelations(contentId)
}

/**
 * Resolve a content item's relations and map each populated slot to its
 * human label (from the type's relation config) for the RelatedContent block.
 */
export async function getRelatedGroups(
  type: string,
  contentId: string,
): Promise<{ title: string; items: ResolvedTarget[] }[]> {
  const def = getContentType(type)
  if (!def) return []
  const resolved = await resolveRelations(contentId)
  return def.relations
    .map((rel) => ({ title: rel.label, items: resolved[rel.key] ?? [] }))
    .filter((g) => g.items.length > 0)
}

/**
 * Build Next.js Metadata from a content record, honouring per-content SEO
 * overrides and the type's SEO defaults. Falls back to title/excerpt.
 */
export function buildCmsMetadata(
  type: string,
  content: {
    title: string
    excerpt?: string | null
    seoTitle?: string | null
    seoDescription?: string | null
    seoKeywords?: string[]
    ogImageUrl?: string | null
    coverImageUrl?: string | null
    canonicalUrl?: string | null
    noindex?: boolean
  } | null,
): Metadata {
  const def = getContentType(type)
  const suffix = def?.seoDefaults?.titleSuffix ?? ""
  if (!content) return { title: "یافت نشد" }

  const title = content.seoTitle || `${content.title}${suffix}`
  const description = content.seoDescription || content.excerpt || undefined
  const image = content.ogImageUrl || content.coverImageUrl || undefined

  return {
    title,
    description,
    keywords: content.seoKeywords?.length ? content.seoKeywords : undefined,
    alternates: content.canonicalUrl ? { canonical: content.canonicalUrl } : undefined,
    robots: content.noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      title,
      description,
      images: image ? [{ url: image }] : undefined,
    },
  }
}
