import type { Metadata } from "next"
import type { Content } from "@prisma/client"
import { getContentType } from "./registry"
import { getContentBySlug, getSingleton, listContent } from "./content"
import { resolveRelations, type ResolvedTarget } from "./relations"
import { getLocalizedData } from "@/lib/i18n/content-translation"
import { getRequestLocale } from "@/lib/i18n/server"

/**
 * Public-facing read helpers. These only ever surface PUBLISHED content and are
 * safe to call from public (unauthenticated) route segments. Business logic and
 * admin gating live elsewhere; this module is deliberately read-only.
 */

async function localizeContent<T extends Content>(item: T | null, locale: string): Promise<T | null> {
  if (!item) return null
  const sourceData = {
    title: item.title,
    excerpt: item.excerpt,
    body: item.body,
    seoTitle: item.seoTitle,
    seoDescription: item.seoDescription,
    seoKeywords: item.seoKeywords,
    fields: item.fields,
    navLabel: item.navLabel,
    breadcrumbLabel: item.breadcrumbLabel,
  }
  const translated = await getLocalizedData({
    entityType: `content:${item.type}`,
    entityId: item.id,
    locale,
    fallback: sourceData,
  })
  return { ...item, ...translated }
}

export async function listPublished(type: string, opts?: { categoryId?: string; page?: number; pageSize?: number }) {
  const [result, locale] = await Promise.all([
    listContent({
      type,
      publicOnly: true,
      categoryId: opts?.categoryId,
      page: opts?.page,
      pageSize: opts?.pageSize ?? 24,
    }),
    getRequestLocale(),
  ])
  return { ...result, items: await Promise.all(result.items.map((item) => localizeContent(item, locale))) as typeof result.items }
}

export async function getPublishedBySlug(type: string, slug: string) {
  const [item, locale] = await Promise.all([getContentBySlug(type, slug, { publicOnly: true }), getRequestLocale()])
  return localizeContent(item, locale)
}

export async function getPublishedSingleton(type: string) {
  const [item, locale] = await Promise.all([getSingleton(type, { publicOnly: true }), getRequestLocale()])
  return localizeContent(item, locale)
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
