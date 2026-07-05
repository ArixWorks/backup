"use client"

import { useState, type ReactNode } from "react"
import { Copy, Check, Loader2, Sparkles } from "lucide-react"
import { apiPost, ApiError } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

export const LOCALES = [
  { value: "fa", label: "فارسی" },
  { value: "en", label: "English" },
  { value: "ru", label: "Русский" },
  { value: "ar", label: "العربية" },
  { value: "tr", label: "Türkçe" },
  { value: "hi", label: "हिन्दी" },
]

export const TONES = [
  { value: "professional", label: "حرفه‌ای" },
  { value: "friendly", label: "صمیمی" },
  { value: "persuasive", label: "متقاعدکننده" },
  { value: "playful", label: "شوخ و جذاب" },
  { value: "concise", label: "کوتاه" },
]

/**
 * Shared generation hook: POSTs a task payload to the content endpoint and
 * exposes loading/result/error state. Keeps every tool component tiny and
 * ensures identical error handling across the studio.
 */
export function useContentTask<TResult>() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TResult | null>(null)

  async function run(payload: Record<string, unknown>) {
    setLoading(true)
    try {
      const res = await apiPost<{ data: TResult }>("/api/v1/admin/ai/content", payload)
      setResult(res.data)
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "خطا در ارتباط با سرویس هوش مصنوعی"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return { loading, result, setResult, run }
}

export function GenerateButton({ loading, disabled }: { loading: boolean; disabled?: boolean }) {
  return (
    <Button type="submit" disabled={loading || disabled} className="gap-2">
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
      {loading ? "در حال تولید…" : "تولید با هوش مصنوعی"}
    </Button>
  )
}

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="gap-1.5"
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        toast.success("کپی شد")
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      کپی
    </Button>
  )
}

export function LocaleSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>زبان خروجی</Label>
      <Select value={value} onValueChange={(v) => onChange(v ?? "fa")}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LOCALES.map((l) => (
            <SelectItem key={l.value} value={l.value}>
              {l.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function ToneSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>لحن</Label>
      <Select value={value} onValueChange={(v) => onChange(v ?? "professional")}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TONES.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function ResultCard({
  title,
  value,
  children,
}: {
  title: string
  value?: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        {value ? <CopyButton value={value} /> : null}
      </div>
      {value ? <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{value}</p> : children}
    </div>
  )
}
