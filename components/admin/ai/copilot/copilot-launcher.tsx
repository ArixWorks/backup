"use client"

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCopilot } from "./copilot-provider"
import { CopilotPanel } from "./copilot-panel"
import { copilotRecordEdits } from "./api"

/**
 * Drop-in Copilot entry point for any admin form. Renders the trigger button and
 * the slide-over panel, and flushes recorded admin edits (feedback learning)
 * whenever the panel closes.
 */
export function CopilotLauncher({
  label,
  className,
}: {
  label?: string
  className?: string
}) {
  const { entityId, mode, pendingEdits, clearEdits } = useCopilot()
  const [open, setOpen] = useState(false)
  const resolvedLabel =
    label ?? (mode === "create" ? "ایجاد با هوش مصنوعی" : "بهبود با هوش مصنوعی")

  async function close() {
    setOpen(false)
    if (pendingEdits.length > 0) {
      try {
        await copilotRecordEdits({ entityId, edits: pendingEdits })
      } catch {
        // best-effort — feedback is non-critical.
      } finally {
        clearEdits()
      }
    }
  }

  // Flush edits if the form unmounts with the panel open.
  useEffect(() => {
    return () => {
      if (pendingEdits.length > 0) {
        void copilotRecordEdits({ entityId, edits: pendingEdits }).catch(() => {})
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} className={className}>
        <Sparkles className="size-4" />
        {resolvedLabel}
      </Button>
      <CopilotPanel open={open} onClose={close} />
    </>
  )
}
