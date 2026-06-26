"use client"

import useSWR from "swr"
import { Package, Gavel, Zap, CheckCircle2, Clock, XCircle, RotateCcw } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { Skeleton } from "@/components/ui/skeleton"
import { formatToman, formatDateTime, formatNumber } from "@/lib/format"

type Order = {
  id: string
  publicId: string
  title: string
  type: string
  status: string
  amount: number
  quantity: number
  createdAt: string
  delivery: {
    method: string
    status: string
    payload: Record<string, unknown> | string | null
    error: string | null
  } | null
}

const payloadLabels: Record<string, string> = {
  username: "نام کاربری",
  password: "رمز عبور",
  email: "ایمیل",
  licenseKey: "کلید لایسنس",
  code: "کد",
  note: "توضیحات",
  url: "لینک",
}

function DeliveryPayload({ payload }: { payload: Record<string, unknown> | string }) {
  if (typeof payload === "string") {
    return (
      <pre className="overflow-x-auto rounded-lg border border-border bg-secondary/60 p-3 text-left font-mono text-sm">
        {payload}
      </pre>
    )
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-secondary/60">
      <dl className="divide-y divide-border">
        {Object.entries(payload)
          .filter(([, value]) => value !== null && value !== undefined && value !== "")
          .map(([key, value]) => (
          <div key={key} className="flex items-center justify-between gap-3 px-3 py-2">
            <dt className="text-xs text-muted-foreground">{payloadLabels[key] ?? key}</dt>
            <dd className="text-left font-mono text-sm" dir="ltr">
              {String(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

const statusMap: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  PENDING: { label: "در انتظار", cls: "bg-warning/15 text-warning", icon: Clock },
  PAID: { label: "پرداخت‌شده", cls: "bg-secondary text-foreground", icon: CheckCircle2 },
  DELIVERED: { label: "تحویل‌شده", cls: "bg-success/15 text-success", icon: CheckCircle2 },
  COMPLETED: { label: "تکمیل‌شده", cls: "bg-success/15 text-success", icon: CheckCircle2 },
  FAILED: { label: "ناموفق", cls: "bg-destructive/15 text-destructive", icon: XCircle },
  REFUNDED: { label: "بازگشت‌خورده", cls: "bg-muted text-muted-foreground", icon: RotateCcw },
  CANCELLED: { label: "لغوشده", cls: "bg-muted text-muted-foreground", icon: XCircle },
}

export default function OrdersPage() {
  const { user } = useSession()
  const { data, isLoading } = useSWR<{ data: Order[] }>(
    user ? "/api/v1/orders" : null,
    fetcher,
    { refreshInterval: 8000 },
  )
  const orders = data?.data ?? []

  if (!user) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        برای مشاهده سفارش‌ها، یک حساب کاربری انتخاب کنید.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <h1 className="flex items-center gap-2 text-xl font-extrabold">
        <Package className="h-5 w-5 text-primary" />
        سفارش‌های من
      </h1>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          هنوز سفارشی ثبت نکرده‌اید.
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const s = statusMap[o.status] ?? statusMap.PENDING
            return (
              <li key={o.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                      {o.type === "AUCTION" ? (
                        <Gavel className="h-5 w-5 text-primary" />
                      ) : (
                        <Zap className="h-5 w-5 text-primary" />
                      )}
                    </span>
                    <div>
                      <h3 className="font-bold">{o.title}</h3>
                      <span className="text-xs text-muted-foreground">
                        کد سفارش {o.publicId} • {formatDateTime(o.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}
                    >
                      <s.icon className="h-3.5 w-3.5" />
                      {s.label}
                    </span>
                    <span className="tabular-nums text-sm font-bold">
                      {formatToman(o.amount)} ت
                    </span>
                  </div>
                </div>

                {o.quantity > 1 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    تعداد: {formatNumber(o.quantity)}
                  </div>
                )}

                {o.delivery?.payload && (
                  <div className="mt-3 space-y-1.5">
                    <span className="text-xs text-muted-foreground">اطلاعات تحویل:</span>
                    <DeliveryPayload payload={o.delivery.payload} />
                  </div>
                )}
                {o.delivery?.error && o.status === "REFUNDED" && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                    <RotateCcw className="h-3.5 w-3.5" />
                    تحویل ناموفق بود و مبلغ به‌صورت خودکار به کیف پول شما بازگشت داده شد.
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
