"use client"

import useSWR from "swr"
import Image from "next/image"
import Link from "next/link"
import { toast } from "sonner"
import { Trophy, Gift, Copy, Wallet, Ticket, KeyRound, Clock, ChevronLeft } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { EmptyState, SignInRequired } from "@/components/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { formatToman, formatDateTime } from "@/lib/format"
import { Stagger, FadeItem } from "@/components/motion"
import { useI18n } from "@/components/i18n-provider"
import type { MessageKey } from "@/lib/i18n/messages"

type Win = {
  id: string
  position: number
  delivered: boolean
  deliveredAt: string | null
  deliveryError: string | null
  claimData: Record<string, unknown> | null
  createdAt: string
  giveaway: {
    slug: string
    title: string
    prizeLabel: string
    prizeKind: "WALLET" | "COUPON" | "INVENTORY" | "CUSTOM"
    image: string | null
  }
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const { t } = useI18n()
  function copy(text: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success(t("wins.copied")),
      () => toast.error(t("wins.copyFailed")),
    )
  }
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-2">
        <span className="text-left font-mono text-sm" dir="ltr">
          {value}
        </span>
        <button
          type="button"
          onClick={() => copy(value)}
          aria-label={t("wins.copy")}
          className="text-muted-foreground transition hover:text-primary"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </dd>
    </div>
  )
}

/** Renders the winner's private claim payload, shaped per prize kind. */
function ClaimDetails({ win }: { win: Win }) {
  const { claimData, giveaway, delivered, deliveryError } = win

  if (!delivered) {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning-foreground">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <p className="leading-relaxed">
          {deliveryError
            ? `در انتظار تحویل دستی: ${deliveryError}`
            : "جایزه‌ی شما به‌زودی توسط تیم پشتیبانی تحویل داده می‌شود."}
        </p>
      </div>
    )
  }

  if (giveaway.prizeKind === "WALLET" && claimData?.amount) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm">
        <Wallet className="h-4 w-4 text-success" />
        <span>
          مبلغ <b className="tabular-nums">{formatToman(Number(claimData.amount))} ت</b> به کیف پول شما واریز شد.
        </span>
      </div>
    )
  }

  if (giveaway.prizeKind === "COUPON" && claimData?.code) {
    return (
      <div className="mt-3 overflow-hidden rounded-lg border border-border bg-secondary/60">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-semibold text-foreground">
          <Ticket className="h-4 w-4 text-primary" />
          کد تخفیف شما
        </div>
        <CopyRow label="کد" value={String(claimData.code)} />
      </div>
    )
  }

  if (giveaway.prizeKind === "INVENTORY") {
    const rows: { label: string; value: unknown }[] = [
      { label: "نام کاربری", value: claimData?.username },
      { label: "رمز عبور", value: claimData?.password },
      { label: "کلید لایسنس", value: claimData?.licenseKey },
      { label: "توضیحات", value: claimData?.note },
    ].filter((r) => r.value)
    if (rows.length === 0) return null
    return (
      <div className="mt-3 overflow-hidden rounded-lg border border-border bg-secondary/60">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-semibold text-foreground">
          <KeyRound className="h-4 w-4 text-primary" />
          اطلاعات دریافت جایزه
        </div>
        <dl className="divide-y divide-border">
          {rows.map((r) => (
            <CopyRow key={r.label} label={r.label} value={String(r.value)} />
          ))}
        </dl>
      </div>
    )
  }

  return null
}

export default function MyPrizesPage() {
  const { user } = useSession()
  const { data, isLoading } = useSWR<{ data: Win[] }>(user ? "/api/v1/giveaways/wins" : null, fetcher, {
    refreshInterval: 15000,
  })
  const wins = data?.data ?? []

  if (!user) {
    return <SignInRequired description="برای مشاهده‌ی جوایز، ابتدا وارد حساب کاربری خود شوید." />
  }

  return (
    <Stagger className="space-y-5">
      <FadeItem>
        <header className="flex items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-xl font-extrabold">
            <Trophy className="h-5 w-5 text-primary" />
            جوایز من
          </h1>
          <Link
            href="/giveaways"
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            همه قرعه‌کشی‌ها
            <ChevronLeft className="h-3.5 w-3.5" />
          </Link>
        </header>
      </FadeItem>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : wins.length === 0 ? (
        <FadeItem>
          <EmptyState
            icon={Gift}
            title="هنوز در هیچ قرعه‌کشی‌ای برنده نشده‌اید"
            description="در قرعه‌کشی‌های فعال شرکت کنید تا شانس بردن جوایز را داشته باشید."
            actionLabel="مشاهده قرعه‌کشی‌های فعال"
            actionHref="/giveaways"
          />
        </FadeItem>
      ) : (
        <ul className="space-y-3">
          {wins.map((w) => (
            <FadeItem key={w.id}>
              <li className="card-premium rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <span className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary">
                    {w.giveaway.image ? (
                      <Image
                        src={w.giveaway.image || "/placeholder.svg"}
                        alt={w.giveaway.title}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    ) : (
                      <Gift className="h-6 w-6 text-primary" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/giveaways/${w.giveaway.slug}`} className="font-bold leading-tight hover:text-primary">
                      {w.giveaway.title}
                    </Link>
                    <p className="mt-0.5 text-sm text-muted-foreground">{w.giveaway.prizeLabel}</p>
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      <Trophy className="h-3 w-3" />
                      نفر {w.position} • {formatDateTime(w.createdAt)}
                    </span>
                  </div>
                </div>
                <ClaimDetails win={w} />
              </li>
            </FadeItem>
          ))}
        </ul>
      )}
    </Stagger>
  )
}
