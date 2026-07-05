"use client"

import { useState } from "react"
import { Sparkles, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useCopilot } from "./copilot-provider"
import { copilotRegenerateField } from "./api"

/**
 * Inline per-field AI action. Place next to any input to regenerate just that
 * field (optionally for a single locale). Applies the result immediately and
 * records the previous value for feedback learning.
 */
export function AiFieldAction({
  field,
  locale,
  label = "بازتولید",
}: {
  field: string
  locale?: string
  label?: string
}) {
  const { entityId, adapter } = useCopilot()
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    try {
      const res = await copilotRegenerateField({
        entityId,
        field,
        locale,
        currentForm: adapter.getForm(),
      })
      const fv = res.data.fields[field]
      if (fv !== undefined) {
        adapter.applyField(field, fv.value)
        toast.success("فیلد بازتولید شد")
      }
    } catch {
      toast.error("بازتولید فیلد ناموفق بود")
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-primary hover:bg-primary/10 disabled:opacity-50"
      aria-label={`${label} با هوش مصنوعی`}
    >
      {busy ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
      {label}
    </button>
  )
}
