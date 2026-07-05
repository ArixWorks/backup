"use client"

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react"
import { getEntityDef, type CopilotEntityDef } from "@/lib/ai/copilot/entities"
import type { CopilotFormObject, CopilotFieldValue } from "@/lib/ai/copilot/types"

/**
 * Form-agnostic Copilot bridge.
 *
 * Every admin form provides an `adapter` that maps between its own state and the
 * Copilot field keys declared in the entity registry. The provider never touches
 * the form directly — it only reads via `getForm()` and writes via `applyField()`.
 * This keeps the whole Copilot UI reusable across product / giveaway / coupon /
 * channel / email forms with zero form-specific code.
 */

export interface CopilotAdapter {
  /** Current form values keyed by Copilot field keys (localized → object). */
  getForm: () => Record<string, unknown>
  /** Apply one generated value onto the form. */
  applyField: (key: string, value: unknown) => void
}

interface CopilotContextValue {
  entityId: string
  def: CopilotEntityDef
  /** Drives the primary button label & default action ("improve" = edit pages). */
  mode: "create" | "edit" | "improve"
  adapter: CopilotAdapter
  /** Latest AI draft awaiting review (null when none). */
  draft: CopilotFormObject | null
  setDraft: (d: CopilotFormObject | null) => void
  /** Merge a partial draft (single-field regen) into the current draft. */
  mergeDraft: (partial: CopilotFormObject) => void
  /** Apply selected field keys from the draft onto the form. */
  applySelected: (keys: string[]) => void
  /** Record an admin edit against the AI suggestion (feedback learning). */
  noteEdit: (field: string, ai: string, admin: string) => void
  pendingEdits: { field: string; ai: string; admin: string }[]
  clearEdits: () => void
  busy: boolean
  setBusy: (b: boolean) => void
}

const CopilotContext = createContext<CopilotContextValue | null>(null)

export function useCopilot(): CopilotContextValue {
  const ctx = useContext(CopilotContext)
  if (!ctx) throw new Error("useCopilot must be used within <CopilotProvider>")
  return ctx
}

export function CopilotProvider({
  entityId,
  mode = "create",
  adapter,
  children,
}: {
  entityId: string
  mode?: "create" | "edit" | "improve"
  adapter: CopilotAdapter
  children: React.ReactNode
}) {
  const def = getEntityDef(entityId)
  if (!def) throw new Error(`Unknown copilot entity: ${entityId}`)

  const [draft, setDraft] = useState<CopilotFormObject | null>(null)
  const [busy, setBusy] = useState(false)
  const editsRef = useRef<{ field: string; ai: string; admin: string }[]>([])
  const [pendingEdits, setPendingEdits] = useState<{ field: string; ai: string; admin: string }[]>(
    [],
  )

  const mergeDraft = useCallback((partial: CopilotFormObject) => {
    setDraft((prev) => {
      if (!prev) return partial
      return {
        ...prev,
        ...partial,
        fields: { ...prev.fields, ...partial.fields },
        imagePrompts: { ...prev.imagePrompts, ...partial.imagePrompts },
      }
    })
  }, [])

  const applySelected = useCallback(
    (keys: string[]) => {
      if (!draft) return
      for (const key of keys) {
        const fv: CopilotFieldValue | undefined = draft.fields[key]
        if (fv !== undefined) adapter.applyField(key, fv.value)
      }
    },
    [draft, adapter],
  )

  const noteEdit = useCallback((field: string, ai: string, admin: string) => {
    if (!ai || !admin || ai.trim() === admin.trim()) return
    const next = editsRef.current.filter((e) => e.field !== field)
    next.push({ field, ai, admin })
    editsRef.current = next
    setPendingEdits(next)
  }, [])

  const clearEdits = useCallback(() => {
    editsRef.current = []
    setPendingEdits([])
  }, [])

  const value = useMemo<CopilotContextValue>(
    () => ({
      entityId,
      def,
      mode,
      adapter,
      draft,
      setDraft,
      mergeDraft,
      applySelected,
      noteEdit,
      pendingEdits,
      clearEdits,
      busy,
      setBusy,
    }),
    [entityId, def, mode, adapter, draft, mergeDraft, applySelected, noteEdit, pendingEdits, clearEdits, busy],
  )

  return <CopilotContext.Provider value={value}>{children}</CopilotContext.Provider>
}
