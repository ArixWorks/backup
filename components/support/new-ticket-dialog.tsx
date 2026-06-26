"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { Loader2, Paperclip, Plus, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { apiPost, ApiError } from "@/lib/api-client"
import { uploadFile } from "@/lib/upload-client"
import { SUPPORT_CATEGORY_LABELS } from "@/lib/support-meta"

export function NewTicketDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState("")
  const [category, setCategory] = useState("GENERAL")
  const [message, setMessage] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    setSubject("")
    setCategory("GENERAL")
    setMessage("")
    setFile(null)
  }

  async function submit() {
    if (subject.trim().length < 3) return toast.error("موضوع را کامل‌تر بنویسید")
    if (message.trim().length < 5) return toast.error("متن پیام بسیار کوتاه است")
    setBusy(true)
    try {
      let attachmentUrl: string | undefined
      if (file) attachmentUrl = await uploadFile(file, "tickets")
      await apiPost("/api/v1/support", { subject, category, message, attachmentUrl })
      toast.success("تیکت با موفقیت ثبت شد")
      reset()
      setOpen(false)
      onCreated()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ثبت تیکت")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            تیکت جدید
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>ثبت تیکت پشتیبانی</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">دسته‌بندی</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {Object.entries(SUPPORT_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">موضوع</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="مثلاً: مشکل در شارژ کیف پول"
              maxLength={120}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">شرح درخواست</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="جزئیات مشکل یا درخواست خود را بنویسید…"
              rows={4}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => fileRef.current?.click()}>
              <Paperclip className="h-4 w-4" />
              پیوست (اختیاری)
            </Button>
            {file && (
              <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                <span className="truncate">{file.name}</span>
                <button type="button" onClick={() => setFile(null)} aria-label="حذف پیوست">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
          </div>

          <Button onClick={submit} disabled={busy} className="mt-1 gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? "در حال ارسال…" : "ارسال تیکت"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
