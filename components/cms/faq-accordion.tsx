import { ChevronDown } from "lucide-react"
import { RichContent } from "@/components/rich-content/rich-content"

export type FaqItem = {
  id: string
  title: string
  body?: string | null
  category?: { name: string } | null
}

/**
 * FAQ list rendered as accessible native <details> disclosures, grouped by
 * category. Uses the platform's built-in open/close semantics so it needs no
 * client JS. Server component.
 */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-card/50 p-10 text-center text-sm text-muted-foreground">
        هنوز پرسشی ثبت نشده است
      </div>
    )
  }

  const groups = new Map<string, FaqItem[]>()
  for (const item of items) {
    const key = item.category?.name ?? "عمومی"
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(item)
  }

  return (
    <div className="space-y-8">
      {[...groups.entries()].map(([category, faqs]) => (
        <section key={category} className="space-y-3">
          {groups.size > 1 ? <h2 className="text-base font-bold text-foreground">{category}</h2> : null}
          <ul className="space-y-2">
            {faqs.map((faq) => (
              <li key={faq.id}>
                <details className="group overflow-hidden rounded-2xl border border-border/60 bg-card">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-medium text-foreground marker:hidden">
                    <span>{faq.title}</span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-border/60 px-4 pb-4 pt-3">
                    <RichContent content={faq.body} className="text-sm" />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
