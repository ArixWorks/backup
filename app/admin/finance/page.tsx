"use client"

import Link from "next/link"
import useSWR from "swr"
import {
  TrendingUp,
  Wallet,
  Lock,
  Banknote,
  ArrowDownToLine,
  Undo2,
  Scale,
  Landmark,
} from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { formatMoney, formatNumber } from "@/lib/format"
import { Skeleton } from "@/components/ui/skeleton"

type CurrencyTotals = {
  currency: string
  totalBalance: string
  frozenBalance: string
  availableBalance: string
  walletCount: number
}
type SystemAccount = { kind: string; currency: string; balance: string }
type FlowPoint = { date: string; inflow: string; outflow: string }
type Overview = {
  currencyTotals: CurrencyTotals[]
  systemAccounts: SystemAccount[]
  pending: {
    deposits: { count: number; amount: string }
    withdrawals: { count: number; amount: string }
    refunds: { count: number; amount: string }
  }
  dailyFlow: FlowPoint[]
  revenue: { currency: string; revenue: string }[]
}
type CurrencyMeta = { code: string; name: string; symbol: string; decimals: number }

const SYS_LABELS: Record<string, string> = {
  SYS_CASH: "نقدینگی (واریزها)",
  SYS_WITHDRAWALS_PAYABLE: "بدهی برداشت‌ها",
  SYS_REVENUE: "درآمد پلتفرم",
  SYS_PROMO_EXPENSE: "هزینه پاداش و کشبک",
  SYS_ADJUSTMENTS: "تعدیلات دستی",
  SYS_FX_CLEARING: "تسویه ارزی",
}

export default function AdminFinancePage() {
  const { data, isLoading } = useSWR<{ data: Overview }>("/api/v1/admin/finance", fetcher, {
    refreshInterval: 20000,
  })
  const { data: curData } = useSWR<{ data: { currencies: CurrencyMeta[] } }>(
    "/api/v1/currencies",
    fetcher,
  )
  const o = data?.data
  const currencies = curData?.data.currencies ?? []
  const decimalsOf = (code: string) => currencies.find((c) => c.code === code)?.decimals ?? 0
  const symbolOf = (code: string) => currencies.find((c) => c.code === code)?.symbol ?? code

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">مالی و حسابداری</h1>
          <p className="text-sm text-muted-foreground">
            نمای کلی موجودی‌ها، جریان وجوه و حساب‌های سیستمی بر پایه دفتر دوطرفه
          </p>
        </div>
        <Link
          href="/admin/finance/reconciliation"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <Scale className="h-4 w-4 text-primary" />
          مغایرت‌گیری
        </Link>
      </div>

      {/* Per-currency balances */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-muted-foreground">موجودی کاربران به تفکیک ارز</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading || !o ? (
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)
          ) : o.currencyTotals.length === 0 ? (
            <p className="text-sm text-muted-foreground">داده‌ای موجود نیست.</p>
          ) : (
            o.currencyTotals.map((c) => {
              const dec = decimalsOf(c.currency)
              const sym = symbolOf(c.currency)
              const rev = o.revenue.find((r) => r.currency === c.currency)
              return (
                <div key={c.currency} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{c.currency}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatNumber(c.walletCount)} کیف پول
                    </span>
                  </div>
                  <div className="mt-3 space-y-2 text-sm">
                    <Row icon={<Wallet className="h-4 w-4" />} label="موجودی کل">
                      {formatMoney(c.totalBalance, dec)} {sym}
                    </Row>
                    <Row icon={<Lock className="h-4 w-4" />} label="مسدودشده">
                      {formatMoney(c.frozenBalance, dec)} {sym}
                    </Row>
                    <Row icon={<TrendingUp className="h-4 w-4" />} label="درآمد پلتفرم" accent>
                      {formatMoney(rev?.revenue ?? "0", dec)} {sym}
                    </Row>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* Pending flows */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-muted-foreground">جریان‌های در انتظار تأیید</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <PendingCard
            href="/admin/deposits"
            label="واریزها"
            icon={<Banknote className="h-5 w-5" />}
            count={o?.pending.deposits.count}
            amount={o?.pending.deposits.amount}
            loading={isLoading}
          />
          <PendingCard
            href="/admin/withdrawals"
            label="برداشت‌ها"
            icon={<ArrowDownToLine className="h-5 w-5" />}
            count={o?.pending.withdrawals.count}
            amount={o?.pending.withdrawals.amount}
            loading={isLoading}
          />
          <PendingCard
            href="/admin/refunds"
            label="بازگشت وجه"
            icon={<Undo2 className="h-5 w-5" />}
            count={o?.pending.refunds.count}
            amount={o?.pending.refunds.amount}
            loading={isLoading}
          />
        </div>
      </section>

      {/* Daily flow chart */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-muted-foreground">
          جریان وجوه ۳۰ روز اخیر ({symbolOf("IRT")})
        </h2>
        {isLoading || !o ? (
          <Skeleton className="h-48 rounded-xl" />
        ) : (
          <DailyFlowChart points={o.dailyFlow} decimals={decimalsOf("IRT")} />
        )}
      </section>

      {/* System accounts */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <Landmark className="h-4 w-4" />
          حساب‌های سیستمی
        </h2>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {isLoading || !o ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : o.systemAccounts.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">حسابی ثبت نشده است.</div>
          ) : (
            <ul className="divide-y divide-border">
              {o.systemAccounts.map((a) => (
                <li
                  key={`${a.kind}-${a.currency}`}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{SYS_LABELS[a.kind] ?? a.kind}</span>
                    <span className="text-xs text-muted-foreground">{a.currency}</span>
                  </div>
                  <span className="tabular-nums text-sm font-bold">
                    {formatMoney(a.balance, decimalsOf(a.currency))} {symbolOf(a.currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Link
          href="/admin/finance/reconciliation"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <Scale className="h-3.5 w-3.5" />
          ابزار مغایرت‌گیری و بازسازی موجودی ←
        </Link>
      </section>
    </div>
  )
}

function Row({
  icon,
  label,
  accent,
  children,
}: {
  icon: React.ReactNode
  label: string
  accent?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className={`tabular-nums font-bold ${accent ? "text-primary" : ""}`}>{children}</span>
    </div>
  )
}

function PendingCard({
  href,
  label,
  icon,
  count,
  amount,
  loading,
}: {
  href: string
  label: string
  icon: React.ReactNode
  count?: number
  amount?: string
  loading: boolean
}) {
  const has = (count ?? 0) > 0
  return (
    <Link
      href={href}
      className={`rounded-xl border p-5 transition-colors hover:border-primary/40 ${
        has ? "border-warning/40 bg-warning/5" : "border-border bg-card"
      }`}
    >
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs">{label}</span>
        <span className={has ? "text-warning" : ""}>{icon}</span>
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-24" />
      ) : (
        <>
          <div className="mt-1 text-2xl font-extrabold tabular-nums">{formatNumber(count ?? 0)}</div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {formatMoney(amount ?? "0", 0)} ت
          </div>
        </>
      )}
    </Link>
  )
}

function DailyFlowChart({ points, decimals }: { points: FlowPoint[]; decimals: number }) {
  const max = points.reduce((m, p) => {
    const hi = Math.max(Number(p.inflow), Number(p.outflow))
    return hi > m ? hi : m
  }, 1)
  const totalIn = points.reduce((s, p) => s + Number(p.inflow), 0)
  const totalOut = points.reduce((s, p) => s + Number(p.outflow), 0)

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-success" />
          ورودی: <span className="font-bold tabular-nums">{formatMoney(totalIn, decimals)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-destructive" />
          خروجی: <span className="font-bold tabular-nums">{formatMoney(totalOut, decimals)}</span>
        </span>
      </div>
      <div className="flex h-40 items-end gap-0.5" role="img" aria-label="نمودار جریان وجوه روزانه">
        {points.map((p) => {
          const inH = (Number(p.inflow) / max) * 100
          const outH = (Number(p.outflow) / max) * 100
          return (
            <div key={p.date} className="group flex flex-1 items-end justify-center gap-px" title={p.date}>
              <div
                className="w-1/2 rounded-t-sm bg-success/70 transition-colors group-hover:bg-success"
                style={{ height: `${Math.max(inH, inH > 0 ? 2 : 0)}%` }}
              />
              <div
                className="w-1/2 rounded-t-sm bg-destructive/60 transition-colors group-hover:bg-destructive"
                style={{ height: `${Math.max(outH, outH > 0 ? 2 : 0)}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>{points[0]?.date}</span>
        <span>{points[points.length - 1]?.date}</span>
      </div>
    </div>
  )
}
