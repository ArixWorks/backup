"use client"

import useSWR from "swr"
import Image from "next/image"
import Link from "next/link"
import { toast } from "sonner"
import { Trophy, Gift, Copy, Wallet, Ticket, Clock, ChevronLeft } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { EmptyState, SignInRequired } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { formatToman, formatDateTime } from "@/lib/format"
import { Stagger, FadeItem } from "@/components/motion"
import { useI18n } from "@/components/i18n-provider"
import { CredentialFields } from "@/components/delivery/credential-fields"
import { TwoFactorCode } from "@/components/delivery/two-factor-code"
import type { DeliveryTemplate } from "@/lib/core/delivery-fields"

type Win = {
  id: string
  position: number
  delivered: boolean
  deliveredAt: string | null
  deliveryError: string | null
  claimData: Record<string, unknown> | null
  template: DeliveryTemplate | null
  has2fa: boolean
  createdAt: string
  giveaway: {
    slug: string
    title: string
    prizeLabel: string
    prizeKind: "WALLET" | "COUPON" | "INVENTORY" | "CUSTOM"
    image: string | null
  }
}

/** Internal control keys stored in claimData that are not user-facing values. */
const CONTROL_KEYS = new Set(["kind"])

function credentialPayload(claimData: Record<string, unknown> | null): Record<string, unknown> {
  if (!claimData) return {}
  return Object.fromEntries(Object.entries(claimData).filter(([k]) => !CONTROL_KEYS.has(k)))
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
  const { t } = useI18n()
  const { claimData, giveaway, delivered, deliveryError } = win

  if (!delivered) {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-xs text-success">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        <p className="leading-relaxed">
          {deliveryError
            ? t("wins.pendingManual", { error: deliveryError })
            : t("wins.pendingAuto")}
        </p>
      </div>
    )
  }

  if (giveaway.prizeKind === "WALLET" && claimData?.amount) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm">
        <Wallet className="h-4 w-4 text-success" />
        <span>{t("wins.walletCredited", { amount: formatToman(Number(claimData.amount)) })}</span>
      </div>
    )
  }

  if (giveaway.prizeKind === "COUPON" && claimData?.code) {
    return (
      <div className="mt-3 overflow-hidden rounded-lg border border-border bg-secondary/60">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-semibold text-foreground">
          <Ticket className="h-4 w-4 text-primary" />
          {t("wins.couponTitle")}
        </div>
        <CopyRow label={t("payload.code")} value={String(claimData.code)} />
      </div>
    )
  }

  // INVENTORY and CUSTOM prizes (and any manually-delivered payload) render
  // their credential fields dynamically against the resolved template. This is
  // what fixes CUSTOM prizes previously falling through to a blank card.
  return (
    <div className="mt-3 space-y-3">
      <CredentialFields
        payload={credentialPayload(claimData)}
        template={win.template}
        title={t("wins.claimTitle")}
      />
      {win.has2fa && <TwoFactorCode winnerId={win.id} />}
    </div>
  )
}

export default function MyPrizesPage() {
  const { user } = useSession()
  const { t } = useI18n()
  const { data, isLoading } = useSWR<{ data: Win[] }>(user ? "/api/v1/giveaways/wins" : null, fetcher, {
    refreshInterval: 15000,
  })
  const wins = data?.data ?? []

  if (!user) {
    return <SignInRequired description={t("wins.signInRequired")} />
  }

  return (
    <Stagger className="space-y-5">
      <FadeItem>
        <PageHeader
          icon={Trophy}
          title={t("giveaways.myWins")}
          action={
            <Link
              href="/giveaways"
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              {t("giveaways.all")}
              <ChevronLeft className="h-3.5 w-3.5" />
            </Link>
          }
        />
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
            title={t("wins.empty")}
            description={t("wins.emptyDesc")}
            actionLabel={t("wins.emptyAction")}
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
                    <Link href={`/giveaways/${w.giveaway.slug}`} dir="auto" className="font-bold leading-tight hover:text-primary">
                      {w.giveaway.title}
                    </Link>
                    <p dir="auto" className="mt-0.5 text-sm text-muted-foreground">{w.giveaway.prizeLabel}</p>
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      <Trophy className="h-3 w-3" />
                      {t("wins.position", { n: w.position })} • {formatDateTime(w.createdAt)}
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
