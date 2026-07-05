"use client"

import { useState } from "react"
import { ShieldCheck, AlertTriangle, XCircle, CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import type { ValidationItem, ValidationResult } from "@/lib/ai/copilot/types"
import { useCopilot } from "./copilot-provider"
import { copilotValidate } from "./api"

const STATUS_ICON = {
  ok: CheckCircle2,
  warn: AlertTriangle,
  error: XCircle,
} as const

const STATUS_CLASS = {
  ok: "text-emerald-600",
  warn: "text-amber-600",
  error: "text-destructive",
} as const

/**
 * Pre-save AI validation. Runs a quality review over the current form and lists
 * issues with a one-click "apply fix" per suggestion.
 */
export function AiValidation() {
  const { entityId, adapter } = useCopilot()
  const [result, setResult] = useState<ValidationResult | null>(null)
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    try {
      const res = await copilotValidate({ entityId, form: adapter.getForm() })
      setResult(res.data)
    } catch {
      toast.error("اعتبارسنجی ناموفق بود")
    } finally {
      setBusy(false)
    }
  }

  function applyFix(item: ValidationItem) {
    if (!item.suggestedFix) return
    adapter.applyField(item.field, item.suggestedFix)
    toast.success(`«${item.label}» اصلاح شد`)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="size-4 text-primary" />
          اعتبارسنجی هوشمند
        </div>
        <Button size="sm" variant="secondary" onClick={run} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          بررسی فرم
        </Button>
      </div>

      {result ? (
        <ul className="flex flex-col gap-1.5">
          {result.items.map((item, i) => {
            const Icon = STATUS_ICON[item.status]
            return (
              <li
                key={`${item.field}-${i}`}
                className="flex items-start gap-2 rounded-md border border-border p-2"
              >
                <Icon className={`mt-0.5 size-4 shrink-0 ${STATUS_CLASS[item.status]}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">{item.label}</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground text-pretty">
                    {item.message}
                  </p>
                  {item.suggestedFix ? (
                    <button
                      type="button"
                      onClick={() => applyFix(item)}
                      className="mt-1 text-[11px] font-medium text-primary hover:underline"
                    >
                      اعمال اصلاح پیشنهادی
                    </button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          پیش از ذخیره، فرم را برای بررسی کیفیت محتوا، قیمت و کامل بودن اطلاعات بررسی کنید.
        </p>
      )}
    </div>
  )
}
