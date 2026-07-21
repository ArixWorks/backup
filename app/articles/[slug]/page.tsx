import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ContentArticle } from "@/components/cms/content-article"
import { getPublishedBySlug, getRelatedGroups, buildCmsMetadata } from "@/lib/cms/public"
import { getRequestLocale, serverCopy } from "@/lib/i18n/server"

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const content = await getPublishedBySlug("article", slug)
  return buildCmsMetadata("article", content)
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params
  const [content, locale] = await Promise.all([getPublishedBySlug("article", slug), getRequestLocale()])
  if (!content) notFound()

  const fields = (content.fields as Record<string, unknown> | null) ?? {}
  const relatedGroups = await getRelatedGroups("article", content.id)

  return (
    <ContentArticle
      title={content.title}
      excerpt={content.excerpt}
      body={content.body}
      coverImageUrl={content.coverImageUrl}
      publishedAt={content.publishedAt}
      readingTime={typeof fields.readingTime === "number" ? fields.readingTime : null}
      category={content.category}
      breadcrumbs={[{ label: serverCopy("articles", locale), href: "/articles" }, { label: content.title }]}
      relatedGroups={relatedGroups}
      locale={locale}
    />
  )
}
