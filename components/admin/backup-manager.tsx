"use client"

import { useEffect, useRef, useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import {
  DatabaseBackup,
  Loader2,
  Send,
  Download,
  Upload,
  Save,
  ShieldAlert,
  Clock,
  CheckCircle2,
} from "lucide-react"
import { fetcher, apiPost, apiPatch, ApiError } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

type BackupConfig = {
  enabled: boolean
  chatId: string
  hour: number
  lastRunDate: string
}

export function BackupManager() {
  const { data, isLoading, mutate } = useSWR<{ data: BackupConfig }>(
    "/api/v1/admin/backup/settings",
    fetcher,
  )
  const [form, setForm] = useState<BackupConfig>({ enabled: true, chatId: "", hour: 0, lastRunDate: "" })
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (data?.data) setForm(data.data)
  }, [data])

  async function saveConfig() {
    setSaving(true)
    try {
      await apiPatch("/api/v1/admin/backup/settings", {
        enabled: form.enabled,
        chatId: form.chatId.trim(),
        hour: form.hour,
      })
      toast.success("تنظیمات پشتیبان‌گیری ذخیره شد")
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ذخیره")
    } finally {
      setSaving(false)
    }
  }

  async function backupNow() {
    setSending(true)
    try {
      const res = await apiPost<{ data: { filename: string; totalRows: number; chatId: string } }>(
        "/api/v1/admin/backup",
        {},
      )
      toast.success(
        `پشتیبان به تلگرام ارسال شد (${res.data.totalRows.toLocaleString("fa-IR")} رکورد) → چت ${res.data.chatId}`,
      )
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "ارسال ناموفق بود")
    } finally {
      setSending(false)
    }
  }

  async function downloadNow() {
    setDownloading(true)
    try {
      const res = await fetch("/api/v1/admin/backup/download", { credentials: "include" })
      if (!res.ok) throw new Error("خطا در ساخت پشتیبان")
      const blob = await res.blob()
      const disposition = res.headers.get("content-disposition") ?? ""
      const match = disposition.match(/filename="(.+?)"/)
      const filename = match?.[1] ?? "subio-backup.json.gz"
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      toast.success("فایل پشتیبان دانلود شد")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "دانلود ناموفق بود")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <DatabaseBackup className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-extrabold">پشتیبان‌گیری و بازیابی</h1>
      </div>

      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
        از کل دیتابیس (کاربران، کیف‌پول‌ها، خرید و فروش‌ها، محصولات، مزایده‌ها، تنظیمات و همه‌چیز)
        یک نسخه پشتیبان فشرده تهیه می‌شود. برای انتقال به سرور دیگر کافی است پروژه را نصب کنید،
        مهاجرت دیتابیس را اجرا کنید و سپس فایل پشتیبان را بازیابی کنید.
      </p>

      {/* Manual actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        <ActionCard
          icon={<Send className="h-5 w-5" />}
          title="پشتیبان فوری به تلگرام"
          desc="ساخت نسخه پشتیبان و ارسال آن به چت ادمین"
          action={
            <Button onClick={backupNow} disabled={sending} className="w-full gap-1.5">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              ارسال به تلگرام
            </Button>
          }
        />
        <ActionCard
          icon={<Download className="h-5 w-5" />}
          title="دانلود مستقیم"
          desc="دریافت فایل پشتیبان روی همین دستگاه"
          action={
            <Button
              onClick={downloadNow}
              disabled={downloading}
              variant="secondary"
              className="w-full gap-1.5"
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              دانلود فایل
            </Button>
          }
        />
        <RestoreCard onDone={() => mutate()} />
      </div>

      {/* Daily backup config */}
      <div className="max-w-xl space-y-5 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-extrabold">پشتیبان‌گیری خودکار روزانه</h2>
        </div>

        {isLoading ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : (
          <>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 p-3">
              <div>
                <div className="font-bold">فعال‌سازی پشتیبان خودکار</div>
                <div className="text-xs text-muted-foreground">
                  هر روز یک نسخه پشتیبان ساخته و به تلگرام ارسال می‌شود
                </div>
              </div>
              <Switch
                checked={form.enabled}
                onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-bold">شناسه چت تلگرام ادمین</Label>
              <span className="text-xs text-muted-foreground">
                فایل پشتیبان به این چت ارسال می‌شود (پیش‌فرض: ۱۶۴۵۳۵۳۷۱۰)
              </span>
              <Input
                inputMode="numeric"
                dir="ltr"
                value={form.chatId}
                onChange={(e) => setForm((f) => ({ ...f, chatId: e.target.value }))}
                placeholder="1645353710"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-bold">ساعت ارسال (به وقت تهران)</Label>
              <span className="text-xs text-muted-foreground">
                ساعت شبانه‌روز که پشتیبان خودکار ارسال می‌شود (۰ = نیمه‌شب ۰۰:۰۰)
              </span>
              <Input
                type="number"
                min={0}
                max={23}
                dir="ltr"
                value={form.hour}
                onChange={(e) =>
                  setForm((f) => ({ ...f, hour: Math.max(0, Math.min(23, Number(e.target.value) || 0)) }))
                }
              />
            </div>

            {form.lastRunDate && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                آخرین پشتیبان خودکار: {form.lastRunDate}
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={saveConfig} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                ذخیره تنظیمات
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ActionCard({
  icon,
  title,
  desc,
  action,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  action: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-primary">{icon}</div>
      <div>
        <div className="font-bold">{title}</div>
        <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</div>
      </div>
      <div className="mt-auto">{action}</div>
    </div>
  )
}

function RestoreCard({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [confirm, setConfirm] = useState("")
  const [restoring, setRestoring] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function restore() {
    if (!file) return toast.error("ابتدا فایل پشتیبان را انتخاب کنید")
    setRestoring(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("confirm", "RESTORE")
      const res = await fetch("/api/v1/admin/backup/restore", {
        method: "POST",
        credentials: "include",
        body: fd,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error?.message ?? "بازیابی ناموفق بود")
      toast.success(`بازیابی کامل شد: ${json.data.totalRows.toLocaleString("fa-IR")} رکورد بازگردانده شد`)
      setOpen(false)
      setFile(null)
      setConfirm("")
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "بازیابی ناموفق بود")
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-5">
      <div className="flex items-center gap-2 text-destructive">
        <Upload className="h-5 w-5" />
      </div>
      <div>
        <div className="font-bold">بازیابی از فایل</div>
        <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          جایگزینی کامل دیتابیس با فایل پشتیبان (مخصوص انتقال سرور)
        </div>
      </div>
      <div className="mt-auto">
        <Button onClick={() => setOpen(true)} variant="destructive" className="w-full gap-1.5">
          <Upload className="h-4 w-4" />
          بازیابی پشتیبان
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              بازیابی دیتابیس
            </DialogTitle>
            <DialogDescription className="leading-relaxed">
              این عملیات تمام داده‌های فعلی را پاک کرده و با محتوای فایل پشتیبان جایگزین می‌کند. این کار
              برگشت‌ناپذیر است. برای تأیید، عبارت <span className="font-mono font-bold">RESTORE</span> را
              وارد کنید.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-bold">فایل پشتیبان (.json.gz)</Label>
              <Input
                ref={inputRef}
                type="file"
                accept=".gz,.json,application/gzip"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-bold">عبارت تأیید</Label>
              <Input
                dir="ltr"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="RESTORE"
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={restoring}>
              انصراف
            </Button>
            <Button
              variant="destructive"
              onClick={restore}
              disabled={restoring || confirm !== "RESTORE" || !file}
              className="gap-1.5"
            >
              {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              بازیابی و جایگزینی
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
