import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { ContentCollection } from "@/components/cms/content-collection"
import { ContentArticle } from "@/components/cms/content-article"
import { resolveCmsIcon } from "@/lib/cms/icons"
import { getContentType } from "@/lib/cms/registry"
import { listPublished, getPublishedBySlug, getRelatedGroups, buildCmsMetadata } from "@/lib/cms/public"
import { getRequestLocale, serverCopy, type ServerCopyKey } from "@/lib/i18n/server"

/**
 * Generic renderers for "collection" content types so each route file stays a
 * thin wrapper. They read the type's registry config (label, icon, basePath)
 * and never hardcode per-type presentation.
 */

export async function CollectionIndex({ type }: { type: string }) {
  const def = getContentType(type)
  if (!def) notFound()
  const [{ items }, locale] = await Promise.all([listPublished(type), getRequestLocale()])
  const copyKeys = ({
    article: ["articles", "articlesDescription"],
    help: ["help", "helpDescription"],
    faq: ["faq", "faqDescription"],
  } as const)[type]
  const title = copyKeys ? serverCopy(copyKeys[0] as ServerCopyKey, locale) : def.labelPlural
  const description = copyKeys ? serverCopy(copyKeys[1] as ServerCopyKey, locale) : def.description
  return (
    <div className="space-y-6">
      <PageHeader icon={resolveCmsIcon(def.icon)} title={title} description={description} />
      <ContentCollection items={items} basePath={def.routing.basePath} locale={locale} />
    </div>
  )
}

export async function collectionDetailMetadata(type: string, slug: string): Promise<Metadata> {
  const content = await getPublishedBySlug(type, slug)
  return buildCmsMetadata(type, content)
}

export async function CollectionDetail({ type, slug }: { type: string; slug: string }) {
  const def = getContentType(type)
  if (!def) notFound()
  const [content, locale] = await Promise.all([getPublishedBySlug(type, slug), getRequestLocale()])
  if (!content) notFound()

  const fields = (content.fields as Record<string, unknown> | null) ?? {}
  const relatedGroups = await getRelatedGroups(type, content.id)

  return (
    <ContentArticle
      title={content.title}
      excerpt={content.excerpt}
      body={content.body}
      coverImageUrl={content.coverImageUrl}
      publishedAt={content.publishedAt}
      readingTime={typeof fields.readingTime === "number" ? fields.readingTime : null}
      category={content.category}
      breadcrumbs={[{ label: def.labelPlural, href: def.routing.basePath }, { label: content.title }]}
      relatedGroups={relatedGroups}
      locale={locale}
    />
  )
}
