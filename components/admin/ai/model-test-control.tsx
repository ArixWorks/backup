"use client"

import { useState } from "react"
import { CheckCircle2, CircleAlert, FlaskConical, Loader2 } from "lucide-react"
import { apiPost, ApiError } from "@/lib/api-client"
import { Button } from "@/components/ui/button"

type Capability = "text" | "image" | "embedding"

type TestResult = {
  ok: boolean
  detail: string
  latencyMs: number
  model?: string
  sample?: string
  dimensions?: number
}

export function ModelTestControl({ model, capability }: { model: string; capability: Capability }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TestResult | null>(null)

  async function testModel() {
    const value = model.trim()
    if (!value) {
      setResult({ ok: false, detail: "ابتدا شناسه مدل را وارد کنید", latencyMs: 0 })
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const response = await apiPost<{ data: TestResult }>("/api/v1/admin/ai/test", {
        provider: "gateway",
        model: value,
        capability,
      })
      setResult(response.data)
    } catch (error) {
      setResult({
        ok: false,
        detail: error instanceof ApiError ? error.message : "تست مدل انجام نشد",
        latencyMs: 0,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-secondary/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {capability === "image" ? "این تست یک تصویر واقعی تولید می‌کند و هزینه دارد؛ فایل ذخیره نمی‌شود." : "مقدار فعلی همین فیلد، حتی قبل از ذخیره تنظیمات، آزمایش می‌شود."}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={testModel} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
          {loading ? "در حال تست…" : "تست مدل"}
        </Button>
      </div>
      {result && (
        <div
          className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${
            result.ok
              ? "border-success/30 bg-success/10 text-success"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
          role="status"
        >
          {result.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
          <div className="min-w-0 space-y-1">
            <p className="font-medium">{result.detail}</p>
            <p className="text-[11px] opacity-80">
              {result.latencyMs > 0 && `زمان پاسخ: ${new Intl.NumberFormat("fa-IR").format(result.latencyMs)}ms`}
              {result.dimensions != null && ` • ابعاد: ${new Intl.NumberFormat("fa-IR").format(result.dimensions)}`}
            </p>
            {result.sample && <p className="break-words text-[11px] opacity-90">نمونه پاسخ: {result.sample}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
