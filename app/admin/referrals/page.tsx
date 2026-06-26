"use client"

import useSWR from "swr"
import { Share2, Users, CheckCircle2, Banknote, ShieldAlert, Crown } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { formatToman, formatNumber } from "@/lib/format"
import { Skeleton } from "@/components/ui/skeleton"

type TopReferrer = {
  id: string
  name: string
  count: number
  converted: number
  earned: string
}
type FraudFlag = {
  id: string
  actorName: string
  reason: string
  createdAt: string
}
type Overview = {
  totalReferredUsers: number
  totalConverted: number
  totalPaidOut: string
  topReferrers: TopReferrer[]
  fraudFlags: FraudFlag[]
}

const FRAUD_REASON_LABELS: Record<string, string> = {
  loop: "حلقه دعوت دوطرفه",
  inviter_cap_reached: "عبور از سقف دعوت",
  account_too_new: "حساب بسیار جدید",
  unknown: "نامشخص",
}

export default function AdminReferralsPage() {
  const { data, isLoading } = useSWR<{ data: Overview }>("/api/v1/admin/referrals", fetcher)
  const o = data?.data

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Share2 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-extrabold">سیستم دعوت</h1>
      </div>

      {isLoading || !o ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              icon={Users}
              label="کل دعوت‌شده‌ها"
              value={formatNumber(o.totalReferredUsers)}
            />
            <StatCard
              icon={CheckCircle2}
              label="تبدیل‌شده (خرید کرده)"
              value={formatNumber(o.totalConverted)}
              accent
            />
            <StatCard
              icon={Banknote}
              label="مجموع پاداش پرداختی (ت)"
              value={formatToman(o.totalPaidOut)}
              accent
            />
          </div>

          <section className="rounded-xl border border-border bg-card">
            <header className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Crown className="h-4 w-4 text-primary" />
              <h2 className="font-bold">دعوت‌کنندگان برتر</h2>
            </header>
            {o.topReferrers.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                هنوز دعوتی ثبت نشده است.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {o.topReferrers.map((r, i) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-bold tabular-nums">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {`${formatNumber(r.count)} دعوت · ${formatNumber(r.converted)} خرید`}
                      </p>
                    </div>
                    <span className="text-gold shrink-0 text-sm font-extrabold tabular-nums">
                      {formatToman(r.earned)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card">
            <header className="flex items-center gap-2 border-b border-border px-4 py-3">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              <h2 className="font-bold">موارد مشکوک (ضدتقلب)</h2>
            </header>
            {o.fraudFlags.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                موردی شناسایی نشده است.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {o.fraudFlags.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                      <ShieldAlert className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {f.actorName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {FRAUD_REASON_LABELS[f.reason] ?? f.reason}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {new Date(f.createdAt).toLocaleDateString("fa-IR")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Users
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className={accent ? "h-4 w-4 text-primary" : "h-4 w-4"} />
        <span className="text-xs">{label}</span>
      </div>
      <div
        className={
          accent
            ? "text-gold mt-2 text-xl font-extrabold tabular-nums"
            : "mt-2 text-xl font-extrabold tabular-nums text-foreground"
        }
      >
        {value}
      </div>
    </div>
  )
}
