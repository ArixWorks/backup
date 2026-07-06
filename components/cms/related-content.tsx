import Link from "next/link"
import Image from "next/image"
import { ChevronLeft } from "lucide-react"
import type { ResolvedTarget } from "@/lib/cms/relations"

/**
 * Renders one or more resolved relation slots as titled sections of linked
 * cards. Deleted / non-existent targets are filtered out so the public page
 * never shows dangling references. Server component (no client JS needed).
 */
export function RelatedContent({
  groups,
}: {
  groups: { title: string; items: ResolvedTarget[] }[]
}) {
  const visible = groups
    .map((g) => ({ ...g, items: g.items.filter((i) => i.exists && i.href) }))
    .filter((g) => g.items.length > 0)

  if (visible.length === 0) return null

  return (
    <div className="space-y-8">
      {visible.map((group) => (
        <section key={group.title} aria-label={group.title} className="space-y-3">
          <h2 className="text-base font-bold text-foreground">{group.title}</h2>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {group.items.map((item) => (
              <li key={`${item.targetType}:${item.targetId}`}>
                <Link
                  href={item.href!}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card transition-colors hover:border-primary/50"
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
                    {item.thumb ? (
                      <Image
                        src={item.thumb || "/placeholder.svg"}
                        alt=""
                        fill
                        sizes="(max-width: 768px) 50vw, 33vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between gap-2 p-3">
                    <span className="line-clamp-2 text-sm font-medium text-foreground">{item.label}</span>
                    <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
