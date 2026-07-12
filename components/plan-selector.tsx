"use client"

import { useMemo } from "react"
import { Check, Package } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import type { MessageKey } from "@/lib/i18n/messages"
import type { PlanVariant } from "@/components/flash-card"

// Attribute keys we know how to render in the comparison table, in display order.
const FEATURE_ROWS: { key: string; label: MessageKey }[] = [
  { key: "duration", label: "plan.feature.duration" },
  { key: "devices", label: "plan.feature.devices" },
  { key: "accountType", label: "plan.feature.accountType" },
  { key: "credentialsControl", label: "plan.feature.credentials" },
  { key: "twoFactor", label: "plan.feature.twoFactor" },
  { key: "warranty", label: "plan.feature.warranty" },
]

export function PlanSelector({
  variants,
  selectedId,
  onSelect,
}: {
  variants: PlanVariant[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const { t, priceValue, currency, num } = useI18n()

  // Only show comparison rows that at least one plan actually defines.
  const activeRows = useMemo(
    () =>
      FEATURE_ROWS.filter((row) =>
        variants.some((v) => {
          const val = v.attributes?.[row.key]
          return val !== null && val !== undefined && val !== ""
        }),
      ),
    [variants],
  )

  const selectedVariant = variants.find((variant) => variant.id === selectedId) ?? variants[0]

  function renderValue(row: { key: string }, v: PlanVariant): React.ReactNode {
    const val = v.attributes?.[row.key]
    if (val === null || val === undefined || val === "") {
      return <span className="text-muted-foreground/50">—</span>
    }
    if (typeof val === "boolean") {
      return val ? (
        <Check className="mx-auto h-4 w-4 text-success" aria-label={t("plan.value.yes")} />
      ) : (
        <span className="text-muted-foreground/50" aria-label={t("plan.value.no")}>
          —
        </span>
      )
    }
    if (row.key === "accountType") {
      return t(val === "private" ? "plan.value.private" : "plan.value.shared")
    }
    if (row.key === "devices") {
      return `${num(Number(val))} ${t("plan.perDevice")}`
    }
    return String(val)
  }

  return (
    <div className="min-w-0 space-y-4">
      {/* Plan cards */}
      <div>
        <h2 className="mb-2 text-sm font-bold">{t("plan.choose")}</h2>
        <div
          role="radiogroup"
          aria-label={t("plan.choose")}
          className="grid gap-2 sm:grid-cols-2"
        >
          {variants.map((v) => {
            const selected = v.id === selectedId
            const soldOut = v.stock <= 0
            const hasDiscount = v.compareAtPrice != null && v.compareAtPrice > v.price
            return (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={soldOut}
                onClick={() => onSelect(v.id)}
                className={`group relative flex flex-col gap-2 rounded-xl border p-3 text-start transition-[background-color,border-color] duration-[var(--duration-fast)] ease-[var(--ease-out-quint)] disabled:cursor-not-allowed disabled:opacity-55 ${
                  selected
                    ? "border-primary bg-primary/10 shadow-sm shadow-primary/10"
                    : "border-border bg-secondary/30 hover:border-primary/40 hover:bg-secondary/50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span dir="auto" className="font-bold leading-5 text-pretty">
                    {v.name}
                  </span>
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                      selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                    }`}
                  >
                    {selected && <Check className="h-3 w-3" />}
                  </span>
                </div>

                <div className="mt-auto flex items-baseline gap-1.5">
                  <span className="text-lg font-extrabold tabular-nums text-primary">
                    {priceValue(v.price)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{currency}</span>
                  {hasDiscount && (
                    <span className="text-[11px] text-muted-foreground line-through tabular-nums">
                      {priceValue(v.compareAtPrice as number)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Package className="h-3 w-3" />
                  {soldOut ? t("flash.soldOut") : `${num(v.stock)} ${t("flash.stock")}`}
                </div>

                {selected && (
                  <span className="absolute -top-2 end-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                    {t("plan.selected")}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Comparison: stacked cards on phones, full matrix from tablet upward. */}
      {activeRows.length > 0 && variants.length > 1 && (
        <div className="min-w-0 max-w-full">
          <h3 className="mb-2 text-xs font-bold text-muted-foreground">{t("plan.compare")}</h3>

          {selectedVariant ? (
            <section
              key={selectedVariant.id}
              aria-label={selectedVariant.name}
              aria-live="polite"
              className="overflow-hidden rounded-xl border border-primary bg-primary/5 sm:hidden"
            >
              <h4 dir="auto" className="border-b border-border px-3 py-2.5 text-sm font-bold text-primary">
                {selectedVariant.name}
              </h4>
              <dl className="divide-y divide-border">
                {activeRows.map((row) => (
                  <div key={row.key} className="flex min-w-0 items-center justify-between gap-3 px-3 py-2 text-xs">
                    <dt className="shrink-0 text-muted-foreground">{t(row.label)}</dt>
                    <dd className="min-w-0 text-end font-medium tabular-nums">{renderValue(row, selectedVariant)}</dd>
                  </div>
                ))}
              </dl>
              {selectedVariant.description ? (
                <div className="border-t border-border px-3 py-3">
                  <p className="mb-1 text-xs font-bold text-foreground">توضیحات پلن</p>
                  <p dir="auto" className="text-pretty text-xs leading-relaxed text-muted-foreground">
                    {selectedVariant.description}
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}

          <div className="hidden max-w-full overflow-x-auto rounded-xl border border-border sm:block">
            <table className="w-full min-w-[420px] border-collapse text-xs">
              <thead>
                <tr className="bg-secondary/50">
                  <th className="p-2 text-start font-medium text-muted-foreground" scope="col" />
                  {variants.map((v) => (
                    <th
                      key={v.id}
                      scope="col"
                      dir="auto"
                      className={`p-2 text-center font-bold ${v.id === selectedId ? "text-primary" : ""}`}
                    >
                      {v.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeRows.map((row) => (
                  <tr key={row.key} className="border-t border-border">
                    <th scope="row" className="p-2 text-start font-medium text-muted-foreground">
                      {t(row.label)}
                    </th>
                    {variants.map((v) => (
                      <td
                        key={v.id}
                        className={`p-2 text-center tabular-nums ${v.id === selectedId ? "bg-primary/5" : ""}`}
                      >
                        {renderValue(row, v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
