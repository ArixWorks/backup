"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Sparkles, Loader2, ClipboardCheck, MessageSquarePlus } from "lucide-react"
import { apiPost, ApiError } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface Summary {
  summary: string
  sentiment: "positive" | "neutral" | "negative"
  priority: "low" | "medium" | "high" | "urgent"
  category: string
  nextAction: string
}

interface DraftReply {
  reply: string
  needsInfo: string[]
}

const SENTIMENT_META: Record<string, { label: string; className: string }> = {
  positive: { label: "مثبت", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  neutral: { label: "خنثی", className: "bg-muted text-muted-foreground" },
  negative: { label: "منفی", className: "bg-destructive/15 text-destructive" },
}
const PRIORITY_META: Record<string, { label: string; className: string }> = {
  low: { label: "کم", className: "bg-muted text-muted-foreground" },
  medium: { label: "متوسط", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  high: { label: "بالا", className: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
  urgent: { label: "فوری", className: "bg-destructive/15 text-destructive" },
}
const CATEGORY_LABELS: Record<string, string> = {
  GENERAL: "عمومی",
  PAYMENT: "پرداخت",
  ORDER: "سفارش",
  REFUND: "بازگشت وجه",
  TECHNICAL: "فنی",
}

/**
 * AI assist for the ticket desk. Advisory only — a draft is inserted into the
 * reply box for the human agent to review and edit before sending. Backed by
 * the shared AI core through /api/v1/admin/support/[publicId]/ai.
 */
export function AiAssistPanel({
  publicId,
  onUseDraft,
}: {
  publicId: string
  onUseDraft: (text: string) => void
}) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [needsInfo, setNeedsInfo] = useState<string[]>([])
  const [loading, setLoading] = useState<"draft" | "summarize" | null>(null)

  async function run(task: "draft" | "summarize") {
    setLoading(task)
    try {
      if (task === "summarize") {
        const res = await apiPost<{ data: Summary }>(`/api/v1/admin/support/${publicId}/ai`, { task })
        setSummary(res.data)
      } else {
        const res = await apiPost<{ data: DraftReply }>(`/api/v1/admin/support/${publicId}/ai`, { task })
        onUseDraft(res.data.reply)
        setNeedsInfo(res.data.needsInfo ?? [])
        toast.success("پیش‌نویس در کادر پاسخ درج شد")
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در سرویس هوش مصنوعی")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-primary/25 bg-primary/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-bold text-primary">
          <Sparkles className="h-4 w-4" />
          دستیار هوشمند پشتیبانی
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => run("summarize")} disabled={loading !== null} className="gap-1.5">
            {loading === "summarize" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardCheck className="h-3.5 w-3.5" />}
            خلاصه و تریاژ
          </Button>
          <Button size="sm" onClick={() => run("draft")} disabled={loading !== null} className="gap-1.5">
            {loading === "draft" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquarePlus className="h-3.5 w-3.5" />}
            پیشنهاد پاسخ
          </Button>
        </div>
      </div>

      {summary ? (
        <div className="space-y-2 rounded-xl border border-border bg-card p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className={SENTIMENT_META[summary.sentiment]?.className}>
              لحن: {SENTIMENT_META[summary.sentiment]?.label}
            </Badge>
            <Badge className={PRIORITY_META[summary.priority]?.className}>
              فوریت: {PRIORITY_META[summary.priority]?.label}
            </Badge>
            <Badge variant="secondary">دسته: {CATEGORY_LABELS[summary.category] ?? summary.category}</Badge>
          </div>
          <p className="text-sm leading-relaxed">{summary.summary}</p>
          <p className="text-xs text-muted-foreground">
            <span className="font-bold text-foreground">اقدام بعدی: </span>
            {summary.nextAction}
          </p>
        </div>
      ) : null}

      {needsInfo.length > 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
          <span className="font-bold">اطلاعات لازم برای پاسخ کامل:</span>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-muted-foreground">
            {needsInfo.map((info, i) => (
              <li key={i}>{info}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
