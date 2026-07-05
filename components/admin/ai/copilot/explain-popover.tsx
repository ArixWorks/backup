"use client"

import { useState } from "react"
import { HelpCircle, Loader2 } from "lucide-react"
import { useCopilot } from "./copilot-provider"
import { copilotExplain } from "./api"

/**
 * "Explain Decision" — an inline "why?" affordance next to important AI
 * suggestions. Shows the reason that shipped with the autofill output, and can
 * fetch a deeper explanation on demand.
 */
export function ExplainPopover({
  field,
  value,
  reason,
}: {
  field: string
  value: unknown
  reason?: string
}) {
  const { entityId, adapter } = useCopilot()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(reason ?? "")
  const [loading, setLoading] = useState(false)

  async function deepen() {
    setLoading(true)
    try {
      const res = await copilotExplain({ entityId, field, value, form: adapter.getForm() })
      setText(res.data.text)
    } catch {
      setText((t) => t || "توضیح در دسترس نیست.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        aria-label="چرا این پیشنهاد؟"
      >
        <HelpCircle className="size-3.5" />
        چرا؟
      </button>
      {open && (
        <div className="absolute top-6 right-0 z-50 w-64 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg">
          <p className="text-xs leading-relaxed text-pretty">
            {text || "توضیحی همراه این پیشنهاد ارسال نشده است."}
          </p>
          <button
            type="button"
            onClick={deepen}
            disabled={loading}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-3 animate-spin" /> : null}
            توضیح بیشتر
          </button>
        </div>
      )}
    </span>
  )
}
