"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, X, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useCopilot } from "./copilot-provider"
import { ExplainPopover } from "./explain-popover"
import { previewValue } from "./format"

/**
 * Preview Draft — shows the AI-generated Form Object as a reviewable diff before
 * anything touches the form. The admin can Apply All, Apply Selected (only the
 * checked fields), or Reject. Nothing is written without explicit approval.
 */
export function PreviewDraft() {
  const { def, draft, setDraft, adapter, applySelected } = useCopilot()
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  const rows = useMemo(() => {
    if (!draft) return []
    return def.fields
      .filter((f) => draft.fields[f.key] !== undefined)
      .map((f) => ({
        field: f,
        fv: draft.fields[f.key],
        current: previewValue(adapter.getForm()[f.key]),
      }))
  }, [draft, def.fields, adapter])

  // Default: everything selected.
  useEffect(() => {
    if (!draft) return
    const init: Record<string, boolean> = {}
    for (const r of rows) init[r.field.key] = true
    setSelected(init)
  }, [draft, rows])

  if (!draft) return null

  const selectedKeys = rows.filter((r) => selected[r.field.key]).map((r) => r.field.key)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" />
          پیش‌نمایش پیشنهاد هوش مصنوعی
        </div>
        <Badge variant="secondary">{rows.length} فیلد</Badge>
      </div>

      {draft.summary ? (
        <p className="rounded-md bg-muted p-2 text-xs leading-relaxed text-muted-foreground text-pretty">
          {draft.summary}
        </p>
      ) : null}

      {draft.recommendedSaleType ? (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-medium">نوع فروش پیشنهادی: {draft.recommendedSaleType.value}</span>
            <ExplainPopover
              field="recommendedSaleType"
              value={draft.recommendedSaleType.value}
              reason={draft.recommendedSaleType.reason}
            />
          </div>
        </div>
      ) : null}

      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {rows.map(({ field, fv, current }) => {
          const next = previewValue(fv.value)
          const changed = next !== current
          return (
            <li key={field.key} className="flex items-start gap-3 p-3">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-primary"
                checked={!!selected[field.key]}
                onChange={(e) =>
                  setSelected((s) => ({ ...s, [field.key]: e.target.checked }))
                }
                aria-label={`اعمال ${field.label}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">{field.label}</span>
                  {field.explainable ? (
                    <ExplainPopover field={field.key} value={fv.value} reason={fv.reason} />
                  ) : null}
                  {!changed ? (
                    <Badge variant="outline" className="text-[10px]">
                      بدون تغییر
                    </Badge>
                  ) : null}
                </div>
                {current ? (
                  <p className="mt-1 truncate text-[11px] text-muted-foreground line-through">
                    {current}
                  </p>
                ) : null}
                <p className="mt-0.5 text-xs leading-relaxed text-foreground text-pretty">{next}</p>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={() => {
            applySelected(rows.map((r) => r.field.key))
            setDraft(null)
          }}
        >
          <Check className="size-4" />
          اعمال همه
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={selectedKeys.length === 0}
          onClick={() => {
            applySelected(selectedKeys)
            setDraft(null)
          }}
        >
          اعمال انتخاب‌شده ({selectedKeys.length})
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
          <X className="size-4" />
          رد کردن
        </Button>
      </div>
    </div>
  )
}
