"use client"

import useSWR, { mutate as globalMutate } from "swr"
import { useState } from "react"
import { toast } from "sonner"
import { Search, Ban, CheckCircle2, Wallet } from "lucide-react"
import { fetcher, apiPost } from "@/lib/api-client"
import { formatToman, formatNumber, formatDateTime } from "@/lib/format"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type AdminUser = {
  id: string
  displayName: string
  alias: string
  username: string | null
  role: "USER" | "SUPPORT" | "ADMIN"
  status: "ACTIVE" | "BANNED"
  createdAt: string
  wallet: { totalBalance: string; frozenBalance: string } | null
  _count: { orders: number; bids: number }
}

const roleLabels: Record<string, string> = {
  USER: "کاربر",
  SUPPORT: "پشتیبان",
  ADMIN: "مدیر",
}

export default function AdminUsersPage() {
  const [q, setQ] = useState("")
  const key = `/api/v1/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`
  const { data, isLoading, mutate } = useSWR<{ ok: boolean; data: AdminUser[] }>(key, fetcher)
  const users = data?.data ?? []

  const [adjustUser, setAdjustUser] = useState<AdminUser | null>(null)
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)

  async function toggleStatus(u: AdminUser) {
    const next = u.status === "BANNED" ? "ACTIVE" : "BANNED"
    try {
      await apiPost(`/api/v1/admin/users/${u.id}/status`, { status: next })
      toast.success(next === "BANNED" ? "کاربر مسدود شد" : "کاربر فعال شد")
      mutate()
    } catch (e: any) {
      toast.error(e.message ?? "خطا")
    }
  }

  async function submitAdjust() {
    if (!adjustUser || !amount || Number(amount) === 0) {
      toast.error("مبلغ معتبر وارد کنید")
      return
    }
    if (!reason.trim()) {
      toast.error("علت تعدیل الزامی است")
      return
    }
    setBusy(true)
    try {
      await apiPost(`/api/v1/admin/users/${adjustUser.id}/adjust`, {
        amount: Number(amount),
        reason: reason.trim(),
      })
      toast.success("موجودی تعدیل شد")
      setAdjustUser(null)
      setAmount("")
      setReason("")
      mutate()
      globalMutate("/api/v1/admin/stats")
    } catch (e: any) {
      toast.error(e.message ?? "خطا در تعدیل موجودی")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">مدیریت کاربران</h1>
        <p className="text-sm text-muted-foreground">جستجو، مسدودسازی و تعدیل موجودی کاربران</p>
      </header>

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="نام، شناسه یا ایمیل…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pr-9"
        />
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">کاربر</TableHead>
              <TableHead className="text-right">نقش</TableHead>
              <TableHead className="text-right">موجودی</TableHead>
              <TableHead className="text-right">فعالیت</TableHead>
              <TableHead className="text-right">عضویت</TableHead>
              <TableHead className="text-left">عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  در حال بارگذاری…
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  کاربری یافت نشد
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{u.displayName}</span>
                      <span className="text-xs text-muted-foreground">{u.alias}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.role === "ADMIN" ? "default" : "secondary"} className="text-[10px]">
                      {roleLabels[u.role]}
                    </Badge>
                    {u.status === "BANNED" && (
                      <Badge variant="destructive" className="mr-1 text-[10px]">
                        مسدود
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm" dir="ltr">
                      {u.wallet ? formatToman(u.wallet.totalBalance) : "۰"}
                    </span>
                    {u.wallet && Number(u.wallet.frozenBalance) > 0 && (
                      <span className="block text-[11px] text-muted-foreground" dir="ltr">
                        مسدود: {formatToman(u.wallet.frozenBalance)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatNumber(u._count.orders)} سفارش · {formatNumber(u._count.bids)} پیشنهاد
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(u.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5"
                        onClick={() => setAdjustUser(u)}
                      >
                        <Wallet className="h-3.5 w-3.5" />
                        تعدیل
                      </Button>
                      {u.role !== "ADMIN" && (
                        <Button
                          size="sm"
                          variant={u.status === "BANNED" ? "ghost" : "ghost"}
                          className={u.status === "BANNED" ? "gap-1.5 text-chart-2" : "gap-1.5 text-destructive"}
                          onClick={() => toggleStatus(u)}
                        >
                          {u.status === "BANNED" ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              رفع مسدودی
                            </>
                          ) : (
                            <>
                              <Ban className="h-3.5 w-3.5" />
                              مسدود
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!adjustUser} onOpenChange={(o) => !o && setAdjustUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعدیل موجودی — {adjustUser?.displayName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              مبلغ مثبت برای شارژ و مبلغ منفی برای کسر. این عملیات در دفتر کل ثبت دائمی می‌شود.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">مبلغ (تومان)</Label>
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="numeric"
                dir="ltr"
                placeholder="مثلاً 500000 یا -500000"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">علت</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="مثلاً جبران خطای تحویل"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAdjustUser(null)}>
              انصراف
            </Button>
            <Button onClick={submitAdjust} disabled={busy}>
              {busy ? "در حال ثبت…" : "ثبت تعدیل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
