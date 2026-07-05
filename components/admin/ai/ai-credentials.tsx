"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { KeyRound, Loader2, Plug, Trash2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react"
import { fetcher, apiPut, apiPost, apiDelete, ApiError } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import type { ProviderDef } from "@/app/admin/ai/page"

interface MaskedCredential {
  provider: string
  hasKey: boolean
  fromDb: boolean
  last4: string | null
  label: string | null
  status: string
  statusDetail: string | null
  lastTestedAt: string | null
}

function StatusBadge({ status }: { status: string }) {
  if (status === "connected")
    return (
      <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" /> متصل
      </Badge>
    )
  if (status === "invalid")
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" /> کلید نامعتبر
      </Badge>
    )
  if (status === "error")
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" /> خطا
      </Badge>
    )
  return <Badge variant="secondary">نامشخص</Badge>
}

export function AiCredentials({ providers }: { providers: ProviderDef[] }) {
  const { data, error, isLoading, mutate } = useSWR<{ data: MaskedCredential[] }>(
    "/api/v1/admin/ai/credentials",
    fetcher,
    { shouldRetryOnError: false },
  )
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)

  // Non-super-admins get 403 — hide the whole section for them.
  if (error instanceof ApiError && error.status === 403) return null

  const creds = data?.data ?? []
  const byProvider = new Map(creds.map((c) => [c.provider, c]))

  async function saveKey(provider: string) {
    const apiKey = drafts[provider]?.trim()
    if (!apiKey || apiKey.length < 8) {
      toast.error("کلید API نامعتبر است")
      return
    }
    setBusy(provider)
    try {
      await apiPut("/api/v1/admin/ai/credentials", { provider, apiKey })
      toast.success("کلید ذخیره شد")
      setDrafts((d) => ({ ...d, [provider]: "" }))
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ذخیره کلید")
    } finally {
      setBusy(null)
    }
  }

  async function removeKey(provider: string) {
    setBusy(provider)
    try {
      await apiDelete(`/api/v1/admin/ai/credentials?provider=${encodeURIComponent(provider)}`)
      toast.success("کلید حذف شد")
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در حذف کلید")
    } finally {
      setBusy(null)
    }
  }

  async function testConnection(provider: string) {
    setBusy(`test:${provider}`)
    try {
      const res = await apiPost<{ data: { ok: boolean; detail: string; latencyMs: number } }>(
        "/api/v1/admin/ai/test",
        { provider },
      )
      if (res.data.ok) toast.success(`اتصال موفق (${res.data.latencyMs}ms) — ${res.data.detail}`)
      else toast.error(`ناموفق: ${res.data.detail}`)
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در تست اتصال")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-2 pt-1">
        <KeyRound className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-extrabold">کلیدهای API</h2>
        <Badge variant="secondary" className="mr-1">مدیر ارشد</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        کلیدها رمزنگاری‌شده ذخیره می‌شوند و هرگز به کلاینت ارسال نمی‌شوند. فقط چهار رقم آخر نمایش
        داده می‌شود. اگر کلیدی ذخیره نشود، مقدار متغیر محیطی استفاده می‌گردد.
      </p>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <div className="space-y-3">
          {providers.map((p) => {
            const cred = byProvider.get(p.id)
            const isBusy = busy === p.id || busy === `test:${p.id}`
            return (
              <div key={p.id} className="rounded-xl border border-border bg-card p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{p.label}</span>
                    {cred?.hasKey && (
                      <span className="font-mono text-xs text-muted-foreground" dir="ltr">
                        •••• {cred.last4}
                      </span>
                    )}
                    {cred?.hasKey && (
                      <Badge variant="secondary" className="text-[10px]">
                        {cred.fromDb ? "پنل" : "از .env"}
                      </Badge>
                    )}
                  </div>
                  {cred && <StatusBadge status={cred.status} />}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    type="password"
                    value={drafts[p.id] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                    placeholder={cred?.hasKey ? "کلید جدید (برای جایگزینی)" : `کلید ${p.label}`}
                    className="font-mono"
                    dir="ltr"
                    autoComplete="off"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => saveKey(p.id)}
                      disabled={isBusy || !(drafts[p.id]?.trim())}
                      className="gap-1"
                    >
                      {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      ذخیره
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => testConnection(p.id)}
                      disabled={isBusy}
                      className="gap-1"
                    >
                      {busy === `test:${p.id}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plug className="h-4 w-4" />
                      )}
                      تست
                    </Button>
                    {cred?.fromDb && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeKey(p.id)}
                        disabled={isBusy}
                        aria-label="حذف کلید"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
                {cred?.statusDetail && cred.status !== "connected" && (
                  <p className="mt-2 text-xs text-destructive" dir="ltr">
                    {cred.statusDetail}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
