"use client"

import useSWR from "swr"
import { ScrollText } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { formatDateTime } from "@/lib/format"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type AuditEntry = {
  id: string
  action: string
  entity: string | null
  entityId: string | null
  meta: Record<string, unknown> | null
  createdAt: string
  actor: { displayName: string; alias: string } | null
}

const actionLabels: Record<string, string> = {
  "deposit.approve": "تأیید واریز",
  "deposit.reject": "رد واریز",
  "withdrawal.approve": "تأیید برداشت",
  "withdrawal.reject": "رد برداشت",
  "withdrawal.paid": "پرداخت برداشت",
  "delivery.complete": "تکمیل تحویل",
  "delivery.fail": "خطای تحویل",
  "user.ban": "مسدودسازی کاربر",
  "user.unban": "رفع مسدودی",
  "wallet.adjust": "تعدیل موجودی",
  "product.create": "ساخت محصول",
  "product.update": "ویرایش محصول",
  "product.visibility": "تغییر نمایش محصول",
  "inventory.add": "افزودن موجودی",
  "inventory.delete": "حذف موجودی",
  "auction.cancel": "لغو مزایده",
}

function actionTone(action: string): string {
  if (action.includes("reject") || action.includes("fail") || action.includes("ban") || action.includes("cancel") || action.includes("delete"))
    return "border-destructive/40 text-destructive"
  if (action.includes("approve") || action.includes("complete") || action.includes("create") || action.includes("paid"))
    return "border-chart-2/40 text-chart-2"
  return "border-border text-muted-foreground"
}

export default function AdminAuditPage() {
  const { data, isLoading } = useSWR<{ ok: boolean; data: AuditEntry[] }>(
    "/api/v1/admin/audit",
    fetcher,
    { refreshInterval: 15000 },
  )
  const entries = data?.data ?? []

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">گزارش رویدادها</h1>
        <p className="text-sm text-muted-foreground">
          ثبت دائمی و تغییرناپذیر تمام عملیات حساس مدیریتی
        </p>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
      ) : entries.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-12 text-center">
          <ScrollText className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">هنوز رویدادی ثبت نشده است</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <Card key={e.id} className="flex items-start gap-4 p-4">
              <div className="mt-0.5">
                <Badge variant="outline" className={actionTone(e.action)}>
                  {actionLabels[e.action] ?? e.action}
                </Badge>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium">{e.actor?.displayName ?? "سیستم"}</span>
                  {e.entity && (
                    <span className="text-muted-foreground">
                      {" "}
                      روی {e.entity}
                      {e.entityId ? ` (${e.entityId.slice(0, 8)}…)` : ""}
                    </span>
                  )}
                </p>
                {e.meta && Object.keys(e.meta).length > 0 && (
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground" dir="ltr">
                    {JSON.stringify(e.meta)}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDateTime(e.createdAt)}
              </span>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
