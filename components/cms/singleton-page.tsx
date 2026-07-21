import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { RichContent } from "@/components/rich-content/rich-content"
import { PageHeader } from "@/components/page-header"
import { resolveCmsIcon } from "@/lib/cms/icons"
import { getContentType } from "@/lib/cms/registry"
import { getPublishedSingleton, buildCmsMetadata } from "@/lib/cms/public"
import { getRequestLocale, serverCopy } from "@/lib/i18n/server"

/**
 * Renders a singleton content type (rules / vps / domain landing) as a document
 * page. The content is fully CMS-managed; service-specific business logic (for
 * vps/domain) is intentionally NOT here and can be layered on later without
 * changing this route or its URL.
 */
export async function buildSingletonMetadata(type: string): Promise<Metadata> {
  const content = await getPublishedSingleton(type)
  return buildCmsMetadata(type, content)
}

export async function CmsSingletonPage({
  type,
  fallbackTitle,
  fallbackDescription,
  children,
}: {
  type: string
  fallbackTitle?: string
  fallbackDescription?: string
  children?: React.ReactNode
}) {
  const def = getContentType(type)
  if (!def) notFound()
  const [content, locale] = await Promise.all([getPublishedSingleton(type), getRequestLocale()])

  const title = content?.title ?? fallbackTitle ?? def.labelPlural
  const localizedDescription = type === "vps" ? serverCopy("vpsDescription", locale) : type === "rules" ? serverCopy("rulesDescription", locale) : null
  const description = localizedDescription ?? content?.excerpt ?? fallbackDescription ?? def.description

  return (
    <div className="space-y-6">
      <PageHeader icon={resolveCmsIcon(def.icon)} title={title} description={description ?? undefined} />
      {content?.body ? (
        <article className="rounded-2xl border border-border/60 bg-card p-6 md:p-8">
          <RichContent content={content.body} showToc />
        </article>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/50 p-10 text-center text-sm text-muted-foreground">
          {serverCopy("unpublished", locale)}
        </div>
      )}
      {children}
    </div>
  )
}
