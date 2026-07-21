import Image from "next/image"
import { CalendarDays, Clock } from "lucide-react"
import { PageHeader, type Crumb } from "@/components/page-header"
import { RichContent } from "@/components/rich-content/rich-content"
import { RelatedContent } from "@/components/cms/related-content"
import type { ResolvedTarget } from "@/lib/cms/relations"
import type { Locale } from "@/lib/i18n/locales"

const localeDate = (d: Date, locale: Locale) => new Date(d).toLocaleDateString(locale === "fa" ? "fa-IR" : locale, { dateStyle: "medium" })

/**
 * Canonical renderer for a single content document (article, tutorial, help
 * item, singleton page). Shows an optional cover, a page header with meta,
 * the sanitized rich body with an auto Table of Contents, and any related
 * content groups. Server component.
 */
export function ContentArticle({
  title,
  excerpt,
  body,
  coverImageUrl,
  publishedAt,
  readingTime,
  category,
  breadcrumbs,
  relatedGroups,
  locale = "fa",
  meta,
}: {
  title: string
  excerpt?: string | null
  body?: string | null
  coverImageUrl?: string | null
  publishedAt?: Date | null
  readingTime?: number | null
  category?: { name: string } | null
  breadcrumbs?: Crumb[]
  relatedGroups?: { title: string; items: ResolvedTarget[] }[]
  locale?: Locale
  /** Extra meta chips rendered under the title (e.g. difficulty, duration). */
  meta?: React.ReactNode
}) {
  return (
    <article className="space-y-6">
      {coverImageUrl ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-border/60 bg-muted md:aspect-[21/9]">
          <Image
            src={coverImageUrl || "/placeholder.svg"}
            alt=""
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 900px"
            className="object-cover"
          />
        </div>
      ) : null}

      <PageHeader
        title={title}
        breadcrumbs={breadcrumbs}
        description={excerpt || undefined}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {category ? (
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-medium text-primary">{category.name}</span>
        ) : null}
        {publishedAt ? (
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {localeDate(publishedAt, locale)}
          </span>
        ) : null}
        {readingTime ? (
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {locale === "fa" ? `${readingTime.toLocaleString("fa-IR")} دقیقه مطالعه` : `${readingTime.toLocaleString(locale)} min read`}
          </span>
        ) : null}
        {meta}
      </div>

      <RichContent content={body} showToc />

      {relatedGroups && relatedGroups.length > 0 ? (
        <div className="border-t border-border/60 pt-8">
          <RelatedContent groups={relatedGroups} />
        </div>
      ) : null}
    </article>
  )
}
