"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Palette, Loader2, Check } from "lucide-react"
import { fetcher, apiPatch, ApiError } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { THEMES, DEFAULT_THEME, type ThemeId } from "@/lib/core/settings"

const THEME_KEY = "theme.active"

/**
 * Admin control for the storefront's visual theme. Selecting a palette previews
 * it live by toggling `data-theme` on <html>; saving persists it so every
 * visitor gets the chosen theme on their next server-rendered load.
 */
export function AppearancePicker() {
  const { data, isLoading, mutate } = useSWR<{ data: Record<string, string> }>(
    "/api/v1/admin/settings",
    fetcher,
  )
  const saved = (data?.data?.[THEME_KEY] as ThemeId) ?? DEFAULT_THEME
  const [selected, setSelected] = useState<ThemeId>(DEFAULT_THEME)
  const [saving, setSaving] = useState(false)

  // Sync the local selection with the persisted value once it loads.
  useEffect(() => {
    if (data?.data) setSelected(saved)
  }, [data, saved])

  function preview(id: ThemeId) {
    setSelected(id)
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", id)
    }
  }

  async function save() {
    setSaving(true)
    try {
      await apiPatch("/api/v1/admin/settings", { [THEME_KEY]: selected })
      toast.success("پوسته فروشگاه ذخیره شد")
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ذخیره پوسته")
      // Revert the live preview to the persisted value on failure.
      preview(saved)
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <Skeleton className="h-64 w-full max-w-xl rounded-xl" />

  const dirty = selected !== saved

  return (
    <div className="max-w-xl space-y-5 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Palette className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-extrabold">پوسته فروشگاه</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        پوستهٔ ظاهری اپلیکیشن را انتخاب کنید. با انتخاب هر گزینه، پیش‌نمایش زنده اعمال
        می‌شود؛ برای اعمال دائمی برای همهٔ کاربران، دکمهٔ ذخیره را بزنید.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {THEMES.map((theme) => {
          const active = selected === theme.id
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => preview(theme.id)}
              aria-pressed={active}
              className={`group relative flex items-center gap-3 rounded-2xl border p-4 text-right transition-all ${
                active
                  ? "border-primary/60 bg-primary/5 ring-1 ring-primary/40"
                  : "border-border bg-secondary/40 hover:border-primary/35"
              }`}
            >
              <span className="flex shrink-0 -space-x-1.5">
                {theme.swatch.map((c, i) => (
                  <span
                    key={i}
                    className="h-7 w-7 rounded-full border-2 border-card"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-foreground">{theme.label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {theme.description}
                </span>
              </span>
              {active && (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {dirty ? "تغییر ذخیره‌نشده دارید" : "ذخیره‌شده"}
        </span>
        <Button onClick={save} disabled={saving || !dirty} className="gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          ذخیره پوسته
        </Button>
      </div>
    </div>
  )
}
