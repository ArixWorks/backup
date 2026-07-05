"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CopilotProvider } from "./copilot-provider"
import { CopilotLauncher } from "./copilot-launcher"
import { useCopilotAdapter, type FieldBinding, type I18nStore } from "./use-copilot-adapter"

export interface ImprovePanelProps {
  entityId: string
  /** Current scalar values for each field key, e.g. { title, description, price }. */
  initial: Record<string, unknown>
  /** Which field keys are localized text (title/description/seo/...). */
  localizedKeys?: string[]
  /** Existing i18n object loaded from the entity, if any. */
  initialI18n?: I18nStore
  /** Persist the collected improvements. Receives changed scalar fields + i18n. */
  onSave: (patch: Record<string, unknown>, i18n: I18nStore) => Promise<void>
  title?: string
}

/**
 * Drop-in "Improve with AI" block for edit pages (الزام #2). Seeds the Copilot
 * with the entity's current values in `improve` mode, collects the fields the
 * admin chooses to apply from the Preview Draft, and persists them via `onSave`.
 * Nothing is written until the admin clicks Save, keeping the review gate intact.
 */
export function ImprovePanel({
  entityId,
  initial,
  localizedKeys = [],
  initialI18n,
  onSave,
  title = "بهبود با هوش مصنوعی",
}: ImprovePanelProps) {
  const [patch, setPatch] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)
  const dirty = Object.keys(patch).length > 0

  const bindings = useMemo<Record<string, FieldBinding>>(() => {
    const out: Record<string, FieldBinding> = {}
    const keys = new Set([...Object.keys(initial), ...localizedKeys])
    for (const key of keys) {
      out[key] = {
        get: () => (key in patch ? patch[key] : initial[key]),
        set: (v) => setPatch((prev) => ({ ...prev, [key]: v })),
        localized: localizedKeys.includes(key),
      }
    }
    return out
    // initial is stable per load; patch changes drive re-reads via get closures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, localizedKeys, patch])

  const { adapter, getI18n, hasTranslations, setI18n } = useCopilotAdapter(bindings)

  // Seed existing translations once.
  useMemo(() => {
    if (initialI18n && Object.keys(initialI18n).length > 0) setI18n(initialI18n)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function save() {
    setSaving(true)
    try {
      await onSave(patch, hasTranslations() ? getI18n() : {})
      setPatch({})
      toast.success("بهبودها ذخیره شد")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در ذخیره")
    } finally {
      setSaving(false)
    }
  }

  return (
    <CopilotProvider entityId={entityId} mode="improve" adapter={adapter}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div>
          <h2 className="font-bold">{title}</h2>
          <p className="text-xs text-muted-foreground">
            هوش مصنوعی محتوای فعلی را تحلیل و بهینه می‌کند؛ پیش از ذخیره می‌توانید هر پیشنهاد را جداگانه بپذیرید.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CopilotLauncher />
          {dirty ? (
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              ذخیره بهبودها
            </Button>
          ) : null}
        </div>
      </div>
    </CopilotProvider>
  )
}
