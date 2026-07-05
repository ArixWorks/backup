"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Sparkles, Loader2, Save } from "lucide-react"
import { fetcher, apiPatch, ApiError } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AiModelConfig } from "@/components/admin/ai/ai-model-config"
import { AiGuardrails } from "@/components/admin/ai/ai-guardrails"
import { AiCredentials } from "@/components/admin/ai/ai-credentials"
import { AiUsagePanel } from "@/components/admin/ai/ai-usage-panel"

// Mirror of AI_SETTING_KEYS on the server (lib/ai/settings.ts).
export const AI_KEYS = {
  enabled: "ai.enabled",
  provider: "ai.provider",
  model: "ai.model",
  temperature: "ai.temperature",
  maxTokens: "ai.maxTokens",
  timeoutMs: "ai.timeoutMs",
  maxRetries: "ai.maxRetries",
  streaming: "ai.streaming",
  dailyTokenLimit: "ai.dailyTokenLimit",
  dailyCostLimitUsd: "ai.dailyCostLimitUsd",
  userRatePerMin: "ai.userRatePerMin",
} as const

export interface ProviderDef {
  id: string
  label: string
  envKey: string
  suggestedModels: string[]
  gatewayZeroConfig: boolean
}

export interface AiSettingsResponse {
  values: Record<string, string>
  source: Record<string, "db" | "env">
  providers: ProviderDef[]
}

export default function AdminAiPage() {
  const { data, isLoading, mutate } = useSWR<{ data: AiSettingsResponse }>(
    "/api/v1/admin/ai/settings",
    fetcher,
  )
  const [form, setForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data?.data?.values) setForm(data.data.values)
  }, [data])

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function save() {
    setSaving(true)
    try {
      const payload: Record<string, string> = {}
      for (const key of Object.values(AI_KEYS)) {
        if (form[key] !== undefined) payload[key] = form[key]
      }
      await apiPatch("/api/v1/admin/ai/settings", payload)
      toast.success("تنظیمات هوش مصنوعی ذخیره شد")
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ذخیره")
    } finally {
      setSaving(false)
    }
  }

  const providers = data?.data?.providers ?? []
  const source = data?.data?.source ?? {}
  const enabled = form[AI_KEYS.enabled] === "true"

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-extrabold">هوش مصنوعی</h1>
      </div>
      <p className="max-w-2xl text-sm text-muted-foreground">
        هسته مشترک هوش مصنوعی پروژه. مدل، Provider و محدودیت‌ها را اینجا تنظیم کنید؛ همه قابلیت‌های
        AI (محصولات، تیکت، محتوا، Copilot و…) از همین تنظیمات استفاده می‌کنند. مقادیر پنل نسبت به
        متغیرهای محیطی اولویت دارند.
      </p>

      {isLoading ? (
        <>
          <Skeleton className="h-72 w-full max-w-2xl rounded-xl" />
          <Skeleton className="h-56 w-full max-w-2xl rounded-xl" />
        </>
      ) : (
        <>
          {/* Master switch */}
          <div
            className={`flex max-w-2xl items-center justify-between gap-3 rounded-xl border p-5 transition-colors ${
              enabled ? "border-primary/60 bg-primary/5" : "border-border bg-card"
            }`}
          >
            <div>
              <div className="text-lg font-extrabold">فعال‌سازی هوش مصنوعی</div>
              <div className="text-xs text-muted-foreground">
                کلید اصلی پلتفرم. با خاموش شدن، تمام درخواست‌های AI در کل پروژه غیرفعال می‌شود.
              </div>
            </div>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => set(AI_KEYS.enabled, e.target.checked ? "true" : "false")}
              className="h-6 w-6 accent-primary"
              aria-label="فعال‌سازی هوش مصنوعی"
            />
          </div>

          <AiModelConfig form={form} set={set} providers={providers} source={source} />
          <AiGuardrails form={form} set={set} source={source} />

          <div className="flex max-w-2xl justify-end">
            <Button onClick={save} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              ذخیره تنظیمات
            </Button>
          </div>

          <AiCredentials providers={providers} />
          <AiUsagePanel />
        </>
      )}
    </div>
  )
}
