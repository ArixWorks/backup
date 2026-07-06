import Link from "next/link"
import Image from "next/image"
import { CalendarDays } from "lucide-react"

const faDate = (d: Date) => new Date(d).toLocaleDateString("fa-IR", { dateStyle: "medium" })

/**
 * Shared grid renderer for any "collection" content type (articles, tutorials,
 * help, faq). Each card links to the item's detail route. Server component.
 */
export type CollectionItem = {
  id: string
  slug: string
  title: string
  excerpt?: string | null
  coverImageUrl?: string | null
  publishedAt?: Date | null
  category?: { name: string } | null
}

export function ContentCollection({
  items,
  basePath,
  emptyLabel = "هنوز محتوایی منتشر نشده است",
}: {
  items: CollectionItem[]
  basePath: string
  emptyLabel?: string
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-card/50 p-10 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    )
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`${basePath}/${item.slug}`}
            className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card transition-colors hover:border-primary/50"
          >
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
              {item.coverImageUrl ? (
                <Image
                  src={item.coverImageUrl || "/placeholder.svg"}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : null}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4">
              {item.category ? (
                <span className="w-fit rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                  {item.category.name}
                </span>
              ) : null}
              <h2 className="line-clamp-2 text-base font-bold text-foreground text-balance">{item.title}</h2>
              {item.excerpt ? (
                <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{item.excerpt}</p>
              ) : null}
              {item.publishedAt ? (
                <span className="mt-auto flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {faDate(item.publishedAt)}
                </span>
              ) : null}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
