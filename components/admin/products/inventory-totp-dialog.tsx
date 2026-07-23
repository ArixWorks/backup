"use client"

/**
 * Admin control for attaching an on-demand 2FA (TOTP) secret to a single shared
 * inventory credential. The Base32 secret is sent once and stored encrypted;
 * `maxUses` caps how many codes each recipient may draw before needing a
 * re-request. Rendered as a per-item button inside the InventoryManager.
 */

import { useState } from "react"
import { toast } from "sonner"
import { ShieldCheck, ShieldOff, Loader2, KeyRound } from "lucide-react"
import { apiPut, apiDelete, ApiError } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function InventoryTotpDialog({
  itemId,
  hasTotp,
  maxUses,
  onChange,
}: {
  itemId: string
  hasTotp: boolean
  maxUses: number | null
  onChange: () => void | Promise<unknown>
}) {
  const [open, setOpen] = useState(false)
  const [secret, setSecret] = useState("")
  const [limit, setLimit] = useState(maxUses != null ? String(maxUses) : "3")
  const [unlimited, setUnlimited] = useState(maxUses == null && hasTotp)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (secret.trim().length < 16) {
      return toast.error("کلید Base32 باید حداقل ۱۶ کاراکتر باشد")
    }
    setSaving(true)
    try {
      await apiPut(`/api/v1/admin/inventory/${itemId}/totp`, {
        secret: secret.trim(),
        maxUses: unlimited ? null : Math.max(1, Number(limit) || 1),
      })
      toast.success("کلید ۲FA ذخیره شد")
      setOpen(false)
      setSecret("")
      await onChange()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در ذخیره کلید")
    } finally {
      setSaving(false)
    }
  }

  async function detach() {
    setSaving(true)
    try {
      await apiDelete(`/api/v1/admin/inventory/${itemId}/totp`)
      toast.success("کلید ۲FA حذف شد")
      setOpen(false)
      await onChange()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در حذف کلید")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-label="مدیریت رمز دومرحله‌ای"
        title={hasTotp ? "رمز ۲FA فعال است" : "افزودن رمز ۲FA"}
        className={
          hasTotp
            ? "text-primary transition hover:opacity-80"
            : "text-muted-foreground transition hover:text-primary"
        }
      >
        <ShieldCheck className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            رمز دومرحله‌ای اکانت
          </DialogTitle>
          <DialogDescription>
            کلید مخفی (Base32) این اکانت را وارد کنید. کاربر به‌جای مشاهده کلید، فقط می‌تواند در لحظه
            کد ۶رقمی دریافت کند. کلید به‌صورت رمزنگاری‌شده ذخیره می‌شود.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="totp-secret">کلید مخفی (Base32)</Label>
            <Input
              id="totp-secret"
              dir="ltr"
              autoComplete="off"
              placeholder={hasTotp ? "برای جایگزینی، کلید جدید را وارد کنید" : "JBSWY3DPEHPK3PXP"}
              value={secret}
              onChange={(e) => setSecret(e.target.value.toUpperCase())}
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="totp-limit">سقف دریافت کد برای هر گیرنده</Label>
            <div className="flex items-center gap-3">
              <Input
                id="totp-limit"
                dir="ltr"
                inputMode="numeric"
                disabled={unlimited}
                className="tabular-nums"
                value={limit}
                onChange={(e) => setLimit(e.target.value.replace(/[^0-9]/g, ""))}
              />
              <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={unlimited}
                  onChange={(e) => setUnlimited(e.target.checked)}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                نامحدود
              </label>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              پس از پایان سقف، کاربر می‌تواند درخواست دریافت مجدد بدهد که در پنل «درخواست‌های ۲FA» بررسی می‌شود.
            </p>
          </div>
        </DialogBody>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {hasTotp ? (
            <Button variant="outline" onClick={detach} disabled={saving} className="gap-2 text-destructive">
              <ShieldOff className="h-4 w-4" />
              حذف رمز ۲FA
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            ذخیره کلید
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
