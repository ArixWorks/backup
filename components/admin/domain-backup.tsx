"use client"

import { useRef, useState } from "react"
import { DatabaseBackup, Download, FileJson, FileSpreadsheet, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"
import { apiPost } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { BACKUP_COLUMNS, parseBackup, type BackupRow } from "@/lib/core/domains/backup"

/**
 * Full backup and restore of the TLD catalog.
 *
 * Export is a plain link-triggered download so the browser streams the file
 * straight from the API rather than buffering it through React state. Restore
 * validates with the same schema the server uses, so the preview an admin
 * approves is exactly what will be written.
 */

const fa = (value: number) => value.toLocaleString("fa-IR")

/** BigInt/Date can't cross JSON, so money and timestamps go over as strings. */
function forTransport(rows: BackupRow[]) {
  return rows.map((row) =>
    Object.fromEntries(
      BACKUP_COLUMNS.map((column) => {
        const value = row[column]
        if (typeof value === "bigint") return [column, value.toString()]
        if (value instanceof Date) return [column, value.toISOString()]
        return [column, value]
      }),
    ),
  )
}

export function DomainBackup({ onRestored }: { onRestored: () => void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [rows, setRows] = useState<BackupRow[]>([])
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  function download(format: "json" | "csv") {
    // Anchor download instead of fetch+blob: keeps the admin's session cookie on
    // the request and lets the server's Content-Disposition name the file.
    const link = document.createElement("a")
    link.href = `/api/v1/admin/domains/export?format=${format}`
    link.rel = "noopener"
    document.body.append(link)
    link.click()
    link.remove()
    toast.success(`خروجی ${format === "json" ? "JSON" : "CSV"} در حال دانلود است.`)
  }

  function validate(source: string) {
    try {
      const parsed = parseBackup(source)
      setRows(parsed)
      toast.success(`${fa(parsed.length)} ردیف معتبر است.`)
    } catch (error) {
      setRows([])
      toast.error(error instanceof Error ? error.message : "فایل معتبر نیست.")
    }
  }

  async function pickFile(file: File | undefined) {
    if (!file) return
    const source = await file.text()
    setText(source)
    validate(source)
  }

  async function restore() {
    setBusy(true)
    try {
      const result = await apiPost<{ data: { created: number; updated: number; total: number } }>(
        "/api/v1/admin/domains",
        { action: "restoreTlds", rows: forTransport(rows) },
      )
      const { created, updated } = result.data
      toast.success(`${fa(created)} پسوند اضافه و ${fa(updated)} پسوند بروزرسانی شد.`)
      setRows([])
      setText("")
      setOpen(false)
      onRestored()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "بازگردانی انجام نشد.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => download("json")}>
        <FileJson data-icon="inline-start" />
        خروجی بک‌آپ
      </Button>
      <Button variant="outline" onClick={() => download("csv")}>
        <FileSpreadsheet data-icon="inline-start" />
        خروجی CSV
      </Button>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <DatabaseBackup data-icon="inline-start" />
        بازگردانی بک‌آپ
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="xl">
          <DialogHeader>
            <DialogTitle>بازگردانی کاتالوگ از بک‌آپ</DialogTitle>
            <DialogDescription>
              فایل JSON یا CSV خروجی را انتخاب کنید. پسوندهای موجود با مقادیر فایل بروزرسانی و پسوندهای تازه اضافه
              می‌شوند؛ هیچ پسوندی حذف نمی‌شود و سفارش‌ها دست‌نخورده می‌مانند.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-4">
            <input
              ref={fileInput}
              type="file"
              accept=".json,.csv,text/csv,application/json"
              className="sr-only"
              onChange={(event) => void pickFile(event.target.files?.[0])}
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => fileInput.current?.click()}>
                <Upload data-icon="inline-start" />
                انتخاب فایل
              </Button>
              <Button variant="outline" onClick={() => validate(text)} disabled={!text.trim()}>
                <Download data-icon="inline-start" />
                اعتبارسنجی و پیش‌نمایش
              </Button>
            </div>

            <label className="flex flex-col gap-2 text-sm font-medium">
              یا محتوای فایل را اینجا بچسبانید
              <textarea
                dir="ltr"
                className="min-h-40 rounded-lg border border-input bg-background p-3 text-left font-mono text-xs"
                placeholder={`${BACKUP_COLUMNS.slice(0, 6).join(",")}, ...`}
                value={text}
                onChange={(event) => {
                  setText(event.target.value)
                  setRows([])
                }}
              />
            </label>

            {rows.length > 0 && (
              <div className="rounded-lg border">
                <div className="flex items-center justify-between border-b p-3 text-sm">
                  <strong>{fa(rows.length)} ردیف معتبر</strong>
                  <span className="text-xs text-muted-foreground">{fa(BACKUP_COLUMNS.length)} ستون</span>
                </div>
                <div className="max-h-56 overflow-auto p-3">
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <span className="text-muted-foreground">پسوند</span>
                    <span className="text-muted-foreground">عنوان</span>
                    <span className="text-muted-foreground">قیمت</span>
                    <span className="text-muted-foreground">وضعیت</span>
                    {rows.slice(0, 60).map((row) => (
                      <div className="contents" key={row.tld}>
                        <span dir="ltr" className="text-left font-mono text-foreground">
                          {row.tld}
                        </span>
                        <span className="truncate text-foreground">{row.title}</span>
                        <span className="text-foreground">{Number(row.basePriceIrt).toLocaleString("fa-IR")}</span>
                        <span className={row.active ? "text-primary" : "text-muted-foreground"}>
                          {row.active ? "فعال" : "غیرفعال"}
                        </span>
                      </div>
                    ))}
                  </div>
                  {rows.length > 60 && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {fa(rows.length - 60)} ردیف دیگر در پیش‌نمایش نمایش داده نشده است.
                    </p>
                  )}
                </div>
              </div>
            )}
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button onClick={() => void restore()} disabled={busy || rows.length === 0}>
              {busy && <Loader2 className="animate-spin" />}
              بازگردانی {rows.length > 0 ? `${fa(rows.length)} ردیف` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
