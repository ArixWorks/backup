"use client"

import { use, useState } from "react"
import useSWR from "swr"
import Link from "next/link"
import { toast } from "sonner"
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  Globe,
  Loader2,
  Server,
  TimerReset,
  XCircle,
} from "lucide-react"
import { apiPost, ApiError, fetcher } from "@/lib/api-client"
import { formatNumber, formatToman } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusChip } from "@/components/orders/status-chip"
import { FulfillmentBadge } from "@/components/admin/fulfillment-badge"
import type { AdminDomainOrderDetail } from "@/lib/orders/shared"

type Response = { data: AdminDomainOrderDetail }

const OPERATION_LABELS: Record<string, string> = {
  REGISTRATION: "ثبت دامنه",
  TRANSFER: "انتقال دامنه",
  RENEWAL: "تمدید دامنه",
}

export default function AdminDomainOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, isLoading, mutate } = useSWR<Response>(`/api/v1/admin/orders/domains/${id}`, fetcher)
  const order = data?.data

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/admin/orders/manage"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4" />
        بازگشت به مدیریت سفارش‌ها
      </Link>

      {isLoading || !order ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <>
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Globe className="h-5 w-5 text-warning" />
                <h1 className="text-xl font-extrabold" dir="ltr">
                  {order.domain}
                </h1>
                <StatusChip status={order.status} />
                <FulfillmentBadge kind="DOMAIN" />
              </div>
              <p className="font-bold">{formatToman(String(order.amount))} تومان</p>
            </div>
            <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Row label="شناسه سفارش" value={order.publicId} />
              <Row label="نوع عملیات" value={OPERATION_LABELS[order.operation] ?? order.operation} />
              <Row
                label="خریدار"
                value={
                  order.user.displayName ||
                  order.user.alias ||
                  order.user.email ||
                  order.user.id ||
                  "کاربر حذف‌شده"
                }
              />
              <Row label="پسوند" value={`.${order.tld}`} />
              {order.extensionCount > 0 && <Row label="دفعات تمدید" value={formatNumber(order.extensionCount)} />}
              {order.failureReason && <Row label="دلیل خطا" value={order.failureReason} />}
            </dl>
          </Card>

          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <div className="flex flex-col gap-5">
              <NameserverCard order={order} />

              {order.events.length > 0 && (
                <Card className="p-5">
                  <h2 className="mb-4 font-bold">تاریخچه رویدادها</h2>
                  <ol className="flex flex-col gap-3">
                    {order.events.map((e, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                        <div>
                          <p className="text-pretty">{e.message || e.type}</p>
                          <p className="text-xs text-muted-foreground">
                            {e.actorType} · {new Date(e.createdAt).toLocaleString("fa-IR")}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </Card>
              )}
            </div>

            <div className="flex flex-col gap-5">
              <DomainActions order={order} onDone={mutate} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium" dir="auto">
        {value}
      </dd>
    </div>
  )
}

function NameserverCard({ order }: { order: AdminDomainOrderDetail }) {
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("کپی شد")
    } catch {
      toast.error("کپی ناموفق بود")
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <Server className="h-4 w-4 text-primary" />
        <h2 className="font-bold">نیم‌سرورها (NS)</h2>
      </div>
      {order.nameservers.length === 0 ? (
        <p className="text-sm text-muted-foreground">کاربر هنوز نیم‌سرورها را ثبت نکرده است.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2" dir="ltr">
          {order.nameservers.map((ns, i) => (
            <li
              key={ns}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-xs text-muted-foreground">NS{i + 1}</span>
                <span className="truncate font-mono">{ns}</span>
              </span>
              <button
                type="button"
                onClick={() => copy(ns)}
                aria-label="کپی"
                className="text-muted-foreground hover:text-foreground"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function DomainActions({ order, onDone }: { order: AdminDomainOrderDetail; onDone: () => void }) {
  const [minutes, setMinutes] = useState("")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState<null | string>(null)

  async function run(action: string, body: Record<string, unknown>, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return
    setBusy(action)
    try {
      await apiPost(`/api/v1/admin/orders/domains/${order.id}/action`, { action, ...body })
      toast.success("انجام شد")
      onDone()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "عملیات ناموفق بود")
    } finally {
      setBusy(null)
    }
  }

  const isTerminal = ["ACTIVE", "COMPLETED", "CANCELLED", "REFUNDED"].includes(order.status)
  // Purchase confirmation is possible while the order is still pending/processing.
  const canPurchase = order.status === "PENDING_PURCHASE" || order.status === "PROCESSING"
  // Completion is meaningful once the buyer has set nameservers.
  const canComplete = order.status === "AWAITING_NAMESERVER_SETUP" || order.status === "AWAITING_NAMESERVERS"

  if (isTerminal) {
    return (
      <Card className="p-5 text-sm text-muted-foreground">
        این سفارش دامنه در وضعیت نهایی است و اقدام دیگری لازم نیست.
      </Card>
    )
  }

  return (
    <Card className="flex flex-col gap-5 p-5">
      {canPurchase && (
        <div className="flex flex-col gap-2">
          <Label className="flex items-center gap-1.5 font-bold text-primary">
            <CheckCircle2 className="h-4 w-4" />
            تأیید خرید دامنه
          </Label>
          <p className="text-[11px] text-muted-foreground">
            پس از تأیید، سفارش به مرحله دریافت نیم‌سرورها از کاربر می‌رود.
          </p>
          <Button
            onClick={() => run("purchase", {})}
            disabled={busy !== null}
            className="gap-2"
          >
            {busy === "purchase" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            تأیید خرید
          </Button>
        </div>
      )}

      {canComplete && (
        <div className="flex flex-col gap-2">
          <Label className="flex items-center gap-1.5 font-bold text-success">
            <CheckCircle2 className="h-4 w-4" />
            تکمیل و فعال‌سازی دامنه
          </Label>
          <p className="text-[11px] text-muted-foreground">
            پس از اعمال نیم‌سرورها روی دامنه، سفارش را تکمیل کنید.
          </p>
          <Button
            onClick={() => run("complete", {})}
            disabled={busy !== null}
            className="gap-2 bg-success text-success-foreground hover:bg-success/90"
          >
            {busy === "complete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            تکمیل سفارش
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-border pt-5">
        <Label className="flex items-center gap-1.5 font-bold">
          <TimerReset className="h-4 w-4" />
          تمدید مهلت نگه‌داری
        </Label>
        <div className="flex gap-2">
          <Input
            value={minutes}
            onChange={(e) => setMinutes(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            dir="ltr"
            placeholder="دقیقه"
            className="font-mono"
          />
          <Button
            variant="outline"
            onClick={() => {
              const m = Number(minutes)
              if (!m || m < 1) return toast.error("مدت زمان را وارد کنید")
              run("extend", { minutes: m })
            }}
            disabled={busy !== null}
            className="shrink-0 gap-2"
          >
            {busy === "extend" ? <Loader2 className="h-4 w-4 animate-spin" /> : <TimerReset className="h-4 w-4" />}
            تمدید
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-5">
        <Label className="flex items-center gap-1.5 font-bold text-destructive">
          <XCircle className="h-4 w-4" />
          رد/ناموفق و بازگشت وجه
        </Label>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="دلیل ناموفق بودن (برای کاربر نمایش داده می‌شود)"
          rows={2}
        />
        <Button
          variant="destructive"
          onClick={() =>
            run(
              "fail",
              { reason: reason.trim() || "سفارش قابل انجام نبود" },
              `رد سفارش دامنه و بازگشت ${formatToman(String(order.amount))} تومان به کیف پول کاربر؟`,
            )
          }
          disabled={busy !== null}
          className="gap-2"
        >
          {busy === "fail" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
          رد و بازگشت وجه
        </Button>
      </div>
    </Card>
  )
}
