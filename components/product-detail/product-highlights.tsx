"use client"

import { CheckCircle2 } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { Stagger, FadeItem } from "@/components/motion"

/**
 * "ویژگی‌ها" — admin-managed, one-line selling points shown as a green-check
 * list inside a single card, exactly like the approved mockup. Hides itself
 * when there are no highlights so the layout stays clean. Shared by the shop
 * and auction detail templates.
 */
export function ProductHighlights({ items }: { items: string[] }) {
  const { t } = useI18n()
  const cleaned = items.map((i) => i.trim()).filter(Boolean)
  if (cleaned.length === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold">{t("detail.features")}</h2>
      {/* One-line selling points as a single card whose rows are split by thin
          dividers, matching the approved mockup. */}
      <div className="overflow-hidden rounded-2xl border border-border bg-secondary/30">
        <Stagger className="divide-y divide-border">
          {cleaned.map((item, i) => (
            <FadeItem key={`${i}-${item}`} className="flex items-center gap-2.5 px-3.5 py-2.5">
              <CheckCircle2 className="size-[18px] shrink-0 text-success" aria-hidden="true" />
              <span dir="auto" className="text-pretty text-sm leading-6 text-foreground/90">
                {item}
              </span>
            </FadeItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}
