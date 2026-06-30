"use client"

import { useId, useRef, useState } from "react"
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
import { useI18n } from "@/components/i18n-provider"
import type { MessageKey } from "@/lib/i18n/messages"

const CATEGORY_OPTIONS: { value: string; key: MessageKey }[] = [
  { value: "GENERAL", key: "supportCat.GENERAL" },
  { value: "PAYMENT", key: "supportCat.PAYMENT" },
  { value: "ORDER", key: "supportCat.ORDER" },
  { value: "REFUND", key: "supportCat.REFUND" },
  { value: "TECHNICAL", key: "supportCat.TECHNICAL" },
]

export function NewTicketDialog({ onCreated }: { onCreated: () => void }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState("")
  const [category, setCategory] = useState("GENERAL")
  const [message, setMessage] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const categoryId = useId()
  const subjectId = useId()
  const messageId = useId()

  function reset() {
    setSubject("")
    setCategory("GENERAL")
    setMessage("")
    setFile(null)
  }

  async function submit() {
    if (subject.trim().length < 3) return toast.error(t("newTicket.errSubject"))
    if (message.trim().length < 5) return toast.error(t("newTicket.errMessage"))
    setBusy(true)
    try {
      let attachmentUrl: string | undefined
      if (file) attachmentUrl = await uploadFile(file, "tickets")
      await apiPost("/api/v1/support", { subject, category, message, attachmentUrl })
      toast.success(t("newTicket.success"))
      reset()
      setOpen(false)
      onCreated()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("newTicket.errSubmit"))
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
            {t("newTicket.button")}
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("newTicket.title")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={categoryId} className="text-xs font-medium text-muted-foreground">{t("newTicket.category")}</label>
            <select
              id={categoryId}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.key)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={subjectId} className="text-xs font-medium text-muted-foreground">{t("newTicket.subject")}</label>
            <Input
              id={subjectId}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("newTicket.subjectPlaceholder")}
              maxLength={120}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={messageId} className="text-xs font-medium text-muted-foreground">{t("newTicket.desc")}</label>
            <Textarea
              id={messageId}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("newTicket.descPlaceholder")}
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
              {t("newTicket.attachOptional")}
            </Button>
            {file && (
              <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                <span className="truncate">{file.name}</span>
                <button type="button" onClick={() => setFile(null)} aria-label={t("ticket.removeAttach")}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
          </div>

          <Button onClick={submit} disabled={busy} className="mt-1 gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? t("newTicket.sending") : t("newTicket.submit")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
