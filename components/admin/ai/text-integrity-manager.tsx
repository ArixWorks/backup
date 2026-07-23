"use client"

import { useState } from "react"
import useSWR from "swr"
import { AlertTriangle, Check, Code2, Database, Loader2, Play, X } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const statuses = [
  ["PENDING", "در انتظار"],
  ["APPROVED", "تأییدشده"],
  ["RESOLVED", "حل‌شده"],
  ["REJECTED", "ردشده"],
  ["STALE", "منقضی"],
] as const

type Finding = {
  id: string
  source: "DATABASE" | "SOURCE_CODE"
  status: string
  entity: string
  recordId: string | null
  field: string
  sourcePath: string | null
  sourceLine: number | null
  originalText: string
  proposedText: string | null
  confidence: number | null
  explanation: string | null
  markers: string[]
  firstSeenAt: string
}
type Payload = { data: { findings: Finding[]; pending: number; sourceApplyEnabled: boolean; latestRun: { status: string; scannedCount: number; suspiciousCount: number; resolvedCount: number; completedAt: string | null } | null } }

async function post(url: string, body?: unknown) {
  const response = await fetch(url, { method: "POST", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined })
  const json = await response.json()
  if (!response.ok || !json.ok) throw new Error(json.error?.message ?? "عملیات ناموفق بود")
  return json
}

export function TextIntegrityManager() {
  const [status, setStatus] = useState("PENDING")
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { data, isLoading, mutate } = useSWR<Payload>(`/api/v1/admin/ai/text-integrity?status=${status}`, fetcher)
  const result = data?.data

  async function scan() {
    setBusy("scan"); setError(null)
    try { await post("/api/v1/admin/ai/text-integrity"); await mutate() } catch (e) { setError(e instanceof Error ? e.message : "خطا") } finally { setBusy(null) }
  }

  async function review(id: string, decision: "approve" | "reject") {
    setBusy(id); setError(null)
    try { await post(`/api/v1/admin/ai/text-integrity/${id}`, { decision }); await mutate() } catch (e) { setError(e instanceof Error ? e.message : "خطا") } finally { setBusy(null) }
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary"><AlertTriangle className="h-5 w-5" /></div>
          <div>
            <p className="font-bold text-foreground">{result?.pending ?? 0} پیشنهاد در انتظار</p>
            <p className="text-sm text-muted-foreground">
              آخرین اسکن: {result?.latestRun?.completedAt ? new Date(result.latestRun.completedAt).toLocaleString("fa-IR") : "هنوز اجرا نشده"}
              {result?.latestRun && result.latestRun.resolvedCount > 0 ? ` — ${result.latestRun.resolvedCount} مورد اصلاح‌شده به‌صورت خودکار حذف شد` : ""}
            </p>
          </div>
        </div>
        <Button onClick={scan} disabled={busy !== null} className="gap-2"><Play className="h-4 w-4" />{busy === "scan" ? "در حال اسکن…" : "اجرای اسکن"}</Button>
      </section>

      {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="flex flex-wrap gap-2" aria-label="فیلتر وضعیت">
        {statuses.map(([value, label]) => <Button key={value} size="sm" variant={status === value ? "default" : "outline"} onClick={() => setStatus(value)}>{label}</Button>)}
      </div>

      {isLoading ? <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : result?.findings.length ? (
        <div className="flex flex-col gap-4">
          {result.findings.map((item) => (
            <article key={item.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary" className="gap-1">{item.source === "DATABASE" ? <Database className="h-3 w-3" /> : <Code2 className="h-3 w-3" />}{item.source === "DATABASE" ? "دیتابیس" : "کد"}</Badge>
                <span className="font-mono text-xs text-muted-foreground" dir="ltr">{item.sourcePath ? `${item.sourcePath}:${item.sourceLine}` : `${item.entity}.${item.field}`}</span>
                {item.confidence !== null && <Badge variant="outline">اطمینان {Math.round(item.confidence * 100)}٪</Badge>}
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4"><p className="mb-2 text-xs font-bold text-destructive">متن فعلی</p><p className="break-words text-sm leading-7">{item.originalText}</p></div>
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="mb-2 text-xs font-bold text-primary">پیشنهاد اصلاح</p><p className="break-words text-sm leading-7">{item.proposedText ?? "مدل اصلاح مطمئنی ارائه نکرده است."}</p></div>
              </div>
              {item.explanation && <p className="text-sm text-muted-foreground">{item.explanation}</p>}
              {item.status === "PENDING" && <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                {item.source === "DATABASE" && item.proposedText && <Button size="sm" onClick={() => review(item.id, "approve")} disabled={busy !== null} className="gap-1">{busy === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}تأیید و اعمال</Button>}
                {item.source === "SOURCE_CODE" && item.proposedText && result?.sourceApplyEnabled && <Button size="sm" onClick={() => review(item.id, "approve")} disabled={busy !== null} className="gap-1">{busy === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}اصلاح خودکار فایل</Button>}
                {item.source === "SOURCE_CODE" && item.proposedText && !result?.sourceApplyEnabled && <span className="text-xs text-muted-foreground">اصلاح خودکار فقط در محیط توسعه فعال است.</span>}
                <Button size="sm" variant="outline" onClick={() => review(item.id, "reject")} disabled={busy !== null} className="gap-1"><X className="h-4 w-4" />رد پیشنهاد</Button>
              </div>}
            </article>
          ))}
        </div>
      ) : <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">موردی در این وضعیت وجود ندارد.</div>}
    </div>
  )
}
