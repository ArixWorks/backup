"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Loader2, Save, Send, ShieldCheck, ShieldAlert } from "lucide-react"
import { fetcher, apiPatch, apiPost, ApiError } from "@/lib/api-client"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

type Sender = { id: string; label: string; from: string }
type Settings = {
  enabled: boolean
  fromName: string
  domain: string
  noreplyAddress: string
  supportAddress: string
  billingAddress: string
  securityAddress: string
  replyTo: string
  blockDisposable: boolean
  ratePerMinute: number
  batchSize: number
  maxAttempts: number
  openTracking: boolean
  clickTracking: boolean
  providerConfigured: boolean
  senders: Sender[]
}

export function EmailSettings() {
  const { data, isLoading, mutate } = useSWR<{ data: Settings }>("/api/v1/admin/email/settings", fetcher)
  const [form, setForm] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  const [testTo, setTestTo] = useState("")
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (data?.data) setForm(data.data)
  }, [data])

  async function save() {
    if (!form) return
    setSaving(true)
    try {
      await apiPatch("/api/v1/admin/email/settings", {
        enabled: form.enabled,
        fromName: form.fromName,
        domain: form.domain,
        noreplyAddress: form.noreplyAddress,
        supportAddress: form.supportAddress,
        billingAddress: form.billingAddress,
        securityAddress: form.securityAddress,
        replyTo: form.replyTo,
        blockDisposable: form.blockDisposable,
        ratePerMinute: form.ratePerMinute,
        batchSize: form.batchSize,
        maxAttempts: form.maxAttempts,
        openTracking: form.openTracking,
        clickTracking: form.clickTracking,
      })
      toast.success("تنظیمات ایمیل ذخیره شد")
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ذخیره")
    } finally {
      setSaving(false)
    }
  }

  async function sendTest() {
    if (!testTo.trim()) return
    setTesting(true)
    try {
      await apiPost("/api/v1/admin/email/test", { to: testTo.trim(), drain: true })
      toast.success("ایمیل آزمایشی ارسال شد — صندوق ورودی را بررسی کنید")
      setTestTo("")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ارسال آزمایشی")
    } finally {
      setTesting(false)
    }
  }

  if (isLoading || !form) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    )
  }

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setForm((f) => (f ? { ...f, [k]: v } : f))

  return (
    <div className="flex flex-col gap-5">
      {/* Provider status banner */}
      <Card
        className={`flex items-center gap-3 p-4 ${
          form.providerConfigured ? "border-success/30" : "border-warning/40"
        }`}
      >
        {form.providerConfigured ? (
          <ShieldCheck className="size-5 shrink-0 text-success" />
        ) : (
          <ShieldAlert className="size-5 shrink-0 text-warning" />
        )}
        <div className="flex-1 text-sm">
          <p className="font-medium">
            {form.providerConfigured ? "ارائه‌دهنده ایمیل (Resend) متصل است" : "کلید Resend تنظیم نشده"}
          </p>
          <p className="text-xs text-muted-foreground">
            {form.providerConfigured
              ? "برای ارسال به مشتری واقعی، دامنه‌ی خود را در Resend تأیید کرده و در زیر وارد کنید."
              : "متغیر محیطی RESEND_API_KEY را تنظیم کنید تا ارسال فعال شود."}
          </p>
        </div>
      </Card>

      {/* Master switch */}
      <Card className="flex items-center justify-between p-4">
        <div>
          <Label className="text-sm font-medium">ارسال ایمیل فعال باشد</Label>
          <p className="text-xs text-muted-foreground">خاموش‌کردن، صف را متوقف می‌کند (ایمیل‌ها در صف می‌مانند).</p>
        </div>
        <Switch checked={form.enabled} onCheckedChange={(v) => set("enabled", v)} />
      </Card>

      {/* Sender identity */}
      <Card className="flex flex-col gap-4 p-4">
        <p className="text-sm font-semibold">هویت فرستنده</p>
        <Field label="نام نمایشی فرستنده">
          <Input value={form.fromName} onChange={(e) => set("fromName", e.target.value)} placeholder="Subio Shop" />
        </Field>
        <Field label="دامنه‌ی تأییدشده (در Resend)">
          <Input
            value={form.domain}
            onChange={(e) => set("domain", e.target.value)}
            placeholder="subio.shop"
            dir="ltr"
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="آدرس noreply">
            <Input value={form.noreplyAddress} onChange={(e) => set("noreplyAddress", e.target.value)} dir="ltr" />
          </Field>
          <Field label="آدرس پشتیبانی">
            <Input value={form.supportAddress} onChange={(e) => set("supportAddress", e.target.value)} dir="ltr" />
          </Field>
          <Field label="آدرس مالی">
            <Input value={form.billingAddress} onChange={(e) => set("billingAddress", e.target.value)} dir="ltr" />
          </Field>
          <Field label="آدرس امنیتی">
            <Input value={form.securityAddress} onChange={(e) => set("securityAddress", e.target.value)} dir="ltr" />
          </Field>
        </div>
        <Field label="آدرس پاسخ (Reply-To) — اختیاری">
          <Input value={form.replyTo} onChange={(e) => set("replyTo", e.target.value)} dir="ltr" />
        </Field>

        {/* Resolved preview */}
        {form.senders.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">پیش‌نمایش آدرس‌ها</p>
            <div className="flex flex-col gap-1">
              {form.senders.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span dir="ltr" className="font-mono">
                    {s.from}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Delivery tuning */}
      <Card className="flex flex-col gap-4 p-4">
        <p className="text-sm font-semibold">تنظیمات ارسال</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="نرخ در د��یقه">
            <Input
              type="number"
              value={form.ratePerMinute}
              onChange={(e) => set("ratePerMinute", Number(e.target.value))}
            />
          </Field>
          <Field label="اندازه دسته (هر tick)">
            <Input type="number" value={form.batchSize} onChange={(e) => set("batchSize", Number(e.target.value))} />
          </Field>
          <Field label="حداکثر تلاش">
            <Input
              type="number"
              value={form.maxAttempts}
              onChange={(e) => set("maxAttempts", Number(e.target.value))}
            />
          </Field>
        </div>
        <ToggleRow
          label="رهگیری باز شدن (Open tracking)"
          checked={form.openTracking}
          onChange={(v) => set("openTracking", v)}
        />
        <ToggleRow
          label="رهگیری کلیک (Click tracking)"
          checked={form.clickTracking}
          onChange={(v) => set("clickTracking", v)}
        />
        <ToggleRow
          label="رد آدرس‌های یک‌بارمصرف"
          checked={form.blockDisposable}
          onChange={(v) => set("blockDisposable", v)}
        />
      </Card>

      <Button onClick={save} disabled={saving} className="self-start">
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        ذخیره تنظیمات
      </Button>

      {/* Test send */}
      <Card className="flex flex-col gap-3 p-4">
        <p className="text-sm font-semibold">ارسال ایمیل آزمایشی</p>
        <p className="text-xs text-muted-foreground">
          برای تست واقعی از ایمیل خودتان یا <span dir="ltr" className="font-mono">delivered@resend.dev</span> استفاده
          کنید (نه example.com).
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="you@example.com"
            dir="ltr"
            className="flex-1"
          />
          <Button onClick={sendTest} disabled={testing || !testTo.trim()} variant="secondary">
            {testing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            ارسال
          </Button>
        </div>
      </Card>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
