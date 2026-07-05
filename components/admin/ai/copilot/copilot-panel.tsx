"use client"

import { useState } from "react"
import { Sparkles, X, Loader2, Wand2, CircleDot, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import type { CopilotApplyMode, SimilarMatch } from "@/lib/ai/copilot/types"
import { useCopilot } from "./copilot-provider"
import { copilotAutofill, copilotImprove } from "./api"
import { PreviewDraft } from "./preview-draft"
import { AiImagePanel } from "./ai-image-panel"
import { AiValidation } from "./ai-validation"

const MODE_LABEL: Record<CopilotApplyMode, string> = {
  replace: "جایگزینی کل فرم",
  "fill-missing": "فقط فیلدهای خالی",
  patch: "فقط موارد انتخابی",
}

export function CopilotPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { def, mode, adapter, setDraft, busy, setBusy, pendingEdits, entityId } = useCopilot()
  const [brief, setBrief] = useState("")
  const [applyMode, setApplyMode] = useState<CopilotApplyMode>(mode === "edit" ? "fill-missing" : "replace")
  const [similar, setSimilar] = useState<SimilarMatch[]>([])
  const [ran, setRan] = useState(false)

  async function generate(improve: boolean) {
    if (!improve && !brief.trim()) {
      toast.error("لطفاً یک توضیح کوتاه وارد کنید")
      return
    }
    setBusy(true)
    setRan(true)
    setSimilar([])
    try {
      const res = improve
        ? await copilotImprove({ entityId, currentForm: adapter.getForm() })
        : await copilotAutofill({
            entityId,
            brief,
            mode: applyMode,
            currentForm: adapter.getForm(),
          })
      setDraft(res.data.form)
      setSimilar(res.data.similar ?? [])
      if ((res.data.similar ?? []).some((s) => s.recommendation === "update")) {
        toast.warning("موارد مشابه پیدا شد — پیش از ایجاد بررسی کنید")
      }
    } catch {
      toast.error("تولید هوش مصنوعی ناموفق بود")
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="fixed inset-y-0 left-0 z-50 flex w-full max-w-md flex-col border-r border-border bg-background shadow-xl"
        role="dialog"
        aria-label={`دستیار هوش مصنوعی ${def.label}`}
      >
        <header className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">دستیار هوش مصنوعی</h2>
              <p className="text-xs text-muted-foreground">{def.label}</p>
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="بستن">
            <X className="size-4" />
          </Button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {/* Generate / Improve controls */}
          <div className="space-y-2">
            <Textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder={
                mode === "edit"
                  ? "توضیح تغییر مورد نظر (اختیاری) — یا مستقیم «بهبود» را بزنید"
                  : "مثلاً: اکانت پرمیوم اسپاتیفای ۶ ماهه با تحویل آنی"
              }
              rows={3}
              className="text-sm"
            />
            <div className="flex items-center gap-2">
              <Select value={applyMode} onValueChange={(v) => setApplyMode(v as CopilotApplyMode)}>
                <SelectTrigger className="h-9 flex-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MODE_LABEL) as CopilotApplyMode[]).map((m) => (
                    <SelectItem key={m} value={m} className="text-xs">
                      {MODE_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => generate(false)} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                ایجاد با هوش مصنوعی
              </Button>
              {mode === "edit" ? (
                <Button variant="secondary" onClick={() => generate(true)} disabled={busy}>
                  <Wand2 className="size-4" />
                  بهبود
                </Button>
              ) : null}
            </div>
          </div>

          {busy ? <WorkflowProgress /> : null}

          {similar.length > 0 ? (
            <>
              <Separator />
              <SimilarList matches={similar} />
            </>
          ) : null}

          {ran ? (
            <>
              <Separator />
              <PreviewDraft />
            </>
          ) : null}

          <Separator />
          <AiImagePanel />

          <Separator />
          <AiValidation />

          {pendingEdits.length > 0 ? (
            <p className="text-[11px] text-muted-foreground">
              {pendingEdits.length} اصلاح شما برای بهبود پیشنهادهای بعدی ثبت خواهد شد.
            </p>
          ) : null}
        </div>
      </aside>
    </>
  )
}

const STEPS = ["تحلیل درخواست", "بررسی موارد مشابه", "پیشنهاد قیمت و دسته", "تولید محتوای چندزبانه", "آماده‌سازی پیش‌نمایش"]

function WorkflowProgress() {
  return (
    <ul className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/40 p-3">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-2 text-xs text-muted-foreground">
          {i === 0 ? (
            <Loader2 className="size-3.5 animate-spin text-primary" />
          ) : (
            <CircleDot className="size-3.5" />
          )}
          {s}
        </li>
      ))}
    </ul>
  )
}

function SimilarList({ matches }: { matches: SimilarMatch[] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <AlertCircle className="size-4 text-amber-600" />
        موارد مشابه ({matches.length})
      </div>
      <ul className="flex flex-col gap-1.5">
        {matches.map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-xs"
          >
            <span className="min-w-0 flex-1 truncate">{m.title}</span>
            <Badge variant={m.recommendation === "update" ? "destructive" : "secondary"}>
              {m.recommendation === "update" ? "به‌روزرسانی؟" : "جدید"}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  )
}
