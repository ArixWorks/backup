"use client"

import { use, useEffect, useRef, useState, type ReactNode } from "react"
import useSWR from "swr"
import { Gavel, Clock, Users, ShieldAlert, TrendingUp, Zap, Calendar, Trophy, XCircle } from "lucide-react"
import {
  deriveAuctionDisplayState,
  isEndingSoon,
  IMAGE_TREATMENT_CLASS,
  TONE_PILL_CLASS,
} from "@/lib/core/auction/display-state"
import { fetcher } from "@/lib/api-client"
import { RichContent, CollapsibleContent } from "@/components/rich-content"
import { BidPanel } from "@/components/bid-panel"
import { WatchButton } from "@/components/watch-button"
import { SegmentedCountdown } from "@/components/segmented-countdown"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { DeliveryBadge } from "@/components/delivery-badge"
import { ProductDetailShell } from "@/components/product-detail/product-detail-shell"
import { formatToman, formatDateTime, formatRelative, formatNumber } from "@/lib/format"
import { useI18n } from "@/components/i18n-provider"
import { useSession } from "@/hooks/use-session"
import { CelebrationOverlay } from "@/components/celebration-overlay"
import { ProductQuestions } from "@/components/product-questions"

type Bid = {
  id: string
  amount: number
  alias: string
  name: string
  photoUrl: string | null
  isAuto: boolean
  createdAt: string
}

type AuctionDetail = {
  id: string
  productId: string
  title: string
  subtitle: string | null
  description: string | null
  category: string | null
  coverImage: string | null
  deliveryType: string
  tags: string[]
  highlights: string[]
  startPrice: number
  currentPrice: number
  minNextBid: number
  minimumIncrement: number
  buyNowPrice: number | null
  buyNowAvailable: boolean
  estimatedValue: number | null
  reserve: { exists: boolean; state: "met" | "not_met" | "hidden"; amount: number | null }
  startTime: string
  endTime: string
  status: string
  quantity: number
  bidCount: number
  proxyBidEnabled: boolean
  winnerUserId: string | null
  finalPrice: number | null
  endReason: string | null
  winner: { alias: string; name: string; photoUrl: string | null } | null
  bids: Bid[]
}

export default function AuctionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = useI18n()
  const { user } = useSession()
  const { id } = use(params)
  const bidPanelRef = useRef<HTMLDivElement>(null)
  const { data, isLoading, mutate } = useSWR<{ data: AuctionDetail }>(
    `/api/v1/auctions/${id}`,
    fetcher,
    { refreshInterval: 5000 },
  )
  const a = data?.data

  const [endingSoon, setEndingSoon] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  useEffect(() => {
    const au = data?.data
    const liveNonTerminal =
      au != null && au.status === "ACTIVE" && au.finalPrice == null && au.endReason == null
    if (!au || !liveNonTerminal) {
      setEndingSoon(false)
      return
    }
    const tick = () => setEndingSoon(isEndingSoon({ isLive: true }, au.endTime))
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [data])

  useEffect(() => {
    if (!a?.winnerUserId || a.winnerUserId !== user?.id || a.finalPrice == null) return
    const key = `celebrated:auction:${a.id}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, "1")
    } catch {
      // Session storage can be unavailable in hardened browsers; still celebrate.
    }
    setCelebrating(true)
  }, [a?.finalPrice, a?.id, a?.winnerUserId, user?.id])

  if (isLoading || !a) {
    return (
      <div className="space-y-6 pt-4" role="status" aria-busy="true">
        <Skeleton className="aspect-[4/5] w-full rounded-2xl sm:aspect-[16/10]" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-3/4 rounded-lg" />
          <Skeleton className="h-5 w-40 rounded-full" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
        <span className="sr-only">Loading…</span>
      </div>
    )
  }

  // Single source of truth for presentation (shared with the card + bot).
  const ds = deriveAuctionDisplayState({
    status: a.status,
    endReason: a.endReason,
    finalPrice: a.finalPrice,
    bidCount: a.bidCount,
  })
  const isLive = ds.isLive
  const isTerminal = ds.isTerminal
  const countdownTarget = ds.isScheduled ? a.startTime : a.endTime
  const showCountdown = ds.isScheduled || ds.isLive
  const priceLabel = isTerminal
    ? ds.hasWinner
      ? t("adetail.finalPrice")
      : t("adetail.reserveNotMet")
    : a.bidCount > 0
      ? t("adetail.topBidNow")
      : t("adetail.basePrice")
  const priceValue = ds.hasWinner && a.finalPrice != null ? a.finalPrice : a.currentPrice

  function scrollToBid() {
    // The primary panel (and its BidPanel) is rendered twice by the shell — an
    // inline mobile copy and a sticky desktop copy — so a single ref would only
    // point at one. Scroll to whichever instance is actually visible.
    if (typeof document === "undefined") return
    const panels = Array.from(document.querySelectorAll<HTMLElement>("[data-bid-panel]"))
    const visible = panels.find((el) => el.offsetParent !== null && el.getClientRects().length > 0)
    ;(visible ?? bidPanelRef.current ?? panels[0])?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    })
  }

  // --- Domain panel: price + stats + countdown + bid form. ----------------
  const primaryPanel = (
    <div className="space-y-4">
      <div className="card-premium space-y-4 rounded-2xl border border-border p-5">
        <div>
          <span className="text-xs text-muted-foreground">{priceLabel}</span>
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-3xl font-extrabold tabular-nums ${
                isTerminal && !ds.hasWinner ? "text-muted-foreground" : "text-primary"
              }`}
            >
              {formatToman(priceValue)}
            </span>
            <span className="text-sm text-muted-foreground">{t("common.toman")}</span>
          </div>
          {!isTerminal && a.estimatedValue != null && (
            <p className="mt-1 flex items-baseline gap-1.5 text-xs text-muted-foreground">
              {t("adetail.trueValue")}:
              <span className="font-semibold tabular-nums line-through">
                {formatToman(a.estimatedValue)} {t("common.toman")}
              </span>
            </p>
          )}
        </div>

        {isTerminal && a.winner && (
          <div className="flex items-center gap-3 rounded-xl border border-success/40 bg-success/10 px-3 py-2.5">
            <Avatar className="h-9 w-9 border border-success/40">
              {a.winner.photoUrl && (
                <AvatarImage src={a.winner.photoUrl} alt={a.winner.name} referrerPolicy="no-referrer" />
              )}
              <AvatarFallback className="bg-success/20 text-xs font-bold text-success">
                {a.winner.name.trim().charAt(0).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1 text-[11px] font-medium text-success">
                <Trophy className="h-3 w-3" />
                {a.endReason === "BUY_NOW" ? t("adetail.soldViaBuyNow") : t("adetail.winner")}
              </span>
              <span dir="auto" className="truncate text-sm font-bold">
                {a.winner.name}
              </span>
            </div>
          </div>
        )}

        <dl className="grid grid-cols-2 divide-x divide-border overflow-hidden rounded-xl border border-border rtl:divide-x-reverse">
          {!isTerminal && (
            <Stat
              icon={<Gavel className="h-3.5 w-3.5" />}
              label={t("adetail.nextMinBid")}
              value={`${formatToman(a.minNextBid)}`}
            />
          )}
          <Stat
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label={t("adetail.minIncrement")}
            value={`${formatToman(a.minimumIncrement)}`}
          />
          <Stat
            icon={<Users className="h-3.5 w-3.5" />}
            label={t("adetail.winnersCount")}
            value={formatNumber(a.quantity)}
          />
          {!isTerminal && a.buyNowAvailable && a.buyNowPrice != null && (
            <Stat
              icon={<Zap className="h-3.5 w-3.5" />}
              label={t("adetail.buyNowStat")}
              value={`${formatToman(a.buyNowPrice)}`}
            />
          )}
          <Stat
            icon={<Calendar className="h-3.5 w-3.5" />}
            label={t("adetail.endTime")}
            value={formatDateTime(a.endTime)}
            small
          />
        </dl>

        {a.reserve.exists && (
          <div
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
              a.reserve.state === "met"
                ? "bg-success/15 text-success"
                : a.reserve.state === "not_met"
                  ? "bg-warning/15 text-warning"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>
              {a.reserve.state === "met"
                ? t("adetail.reserveMet")
                : a.reserve.state === "not_met"
                  ? t("adetail.reserveNotMet")
                  : t("adetail.reserveHidden")}
              {a.reserve.amount != null && (
                <span className="ms-1 font-semibold tabular-nums">
                  {`(${formatToman(a.reserve.amount)})`}
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {showCountdown && (
        <div
          className={`card-premium space-y-3 rounded-2xl border border-border p-5 ${
            endingSoon ? "auction-urgent" : ""
          }`}
        >
          <span
            className={`flex items-center gap-1.5 text-xs font-medium ${
              endingSoon ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            <Clock className="h-4 w-4" />
            {ds.isScheduled
              ? t("adetail.startsIn")
              : endingSoon
                ? t("auctions.endingSoon")
                : t("adetail.endsIn")}
          </span>
          <SegmentedCountdown target={countdownTarget} onComplete={() => mutate()} />
        </div>
      )}

      <div ref={bidPanelRef} data-bid-panel className="scroll-mt-24">
        <BidPanel
          auctionId={a.id}
          minNextBid={a.minNextBid}
          buyNowPrice={a.buyNowAvailable ? a.buyNowPrice : null}
          minimumIncrement={a.minimumIncrement}
          status={a.status}
          proxyBidEnabled={a.proxyBidEnabled}
          onChanged={() => mutate()}
        />
      </div>
    </div>
  )

  // --- Bid history section (kept above the tabs). -------------------------
  const bidHistory = (
    <section className="card-premium overflow-hidden rounded-2xl border border-border">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-bold">
          <Gavel className="h-4 w-4 text-primary" />
          {t("adetail.bidHistory")}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Gavel className="h-3.5 w-3.5" />
          {t("adetail.bids", { n: formatNumber(a.bidCount) })}
        </span>
      </div>
      {a.bids.length === 0 ? (
        <div className="flex flex-col items-center gap-2 p-8 text-center">
          <Gavel className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t("adetail.noBids")}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {a.bids.map((b, i) => (
            <li
              key={b.id}
              className={`flex items-center justify-between px-4 py-3 ${i === 0 ? "bg-primary/5" : ""}`}
            >
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <Avatar className="h-9 w-9 border border-border">
                    {b.photoUrl && (
                      <AvatarImage src={b.photoUrl} alt={b.name} referrerPolicy="no-referrer" />
                    )}
                    <AvatarFallback className="bg-secondary text-xs font-bold text-muted-foreground">
                      {b.name.trim().charAt(0).toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={`absolute -bottom-1 -left-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ring-2 ring-card ${
                      i === 0
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {i === 0 ? <Trophy className="h-2.5 w-2.5" /> : formatNumber(i + 1)}
                  </span>
                </div>
                <div className="flex flex-col text-right">
                  <span dir="auto" className="text-sm font-medium">
                    {b.name}
                  </span>
                  <span dir="auto" className="text-xs text-muted-foreground">
                    {formatRelative(b.createdAt)}
                    {b.isAuto && ` • ${t("adetail.auto")}`}
                  </span>
                </div>
              </div>
              <span className="tabular-nums font-bold">
                {formatToman(b.amount)}{" "}
                <span className="text-xs font-normal text-muted-foreground">{t("common.toman")}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )

  // --- Tabs: overview / bid history / questions. --------------------------
  const overviewTab = (
    <div className="space-y-4">
      {a.description ? (
        <CollapsibleContent>
          <RichContent content={a.description} className="text-foreground/90" />
        </CollapsibleContent>
      ) : (
        <p className="text-sm text-muted-foreground">{t("adetail.overview")}</p>
      )}
    </div>
  )

  return (
    <>
      <CelebrationOverlay
        open={celebrating}
        kind="auction-win"
        subject={a.title}
        image={a.coverImage}
        actionHref="/orders"
        onClose={() => setCelebrating(false)}
      />

      <ProductDetailShell
        title={a.title}
        subtitle={a.subtitle}
        hero={{
          image: a.coverImage,
          backHref: "/auctions",
          treatmentClass: IMAGE_TREATMENT_CLASS[ds.imageTreatment],
          watchSlot: showCountdown ? (
            <WatchButton auctionId={a.id} className="h-9 rounded-full border border-border/50 bg-background/60 px-3 text-xs backdrop-blur-md" />
          ) : undefined,
        }}
        titleMeta={
          <>
            <DeliveryBadge type={a.deliveryType} />
            {a.bidCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10.5px] tabular-nums text-muted-foreground">
                <Gavel className="size-3" />
                {t("adetail.bids", { n: formatNumber(a.bidCount) })}
              </span>
            )}
          </>
        }
        headerAside={
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${TONE_PILL_CLASS[ds.tone]}`}
          >
            {isLive && endingSoon ? (
              <>
                <Clock className="h-3 w-3" />
                {t("auctions.endingSoon")}
              </>
            ) : (
              <>
                {isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
                {ds.hasWinner && <Trophy className="h-3 w-3" />}
                {t(ds.statusKey as Parameters<typeof t>[0])}
              </>
            )}
          </span>
        }
        banner={
          isTerminal ? (
            <div
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 ${TONE_PILL_CLASS[ds.tone]}`}
              role="status"
            >
              {ds.hasWinner ? (
                <Trophy className="h-5 w-5 shrink-0" />
              ) : ds.phase === "cancelled" ? (
                <XCircle className="h-5 w-5 shrink-0" />
              ) : (
                <ShieldAlert className="h-5 w-5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-extrabold leading-tight">
                  {t(ds.statusKey as Parameters<typeof t>[0])}
                </p>
                {ds.hasWinner && a.finalPrice != null && (
                  <p className="text-xs font-medium opacity-90">
                    {t("adetail.finalPrice")}: {formatToman(a.finalPrice)} {t("common.toman")}
                    {a.winner && <span dir="auto"> · {a.winner.name}</span>}
                  </p>
                )}
              </div>
            </div>
          ) : null
        }
        primaryPanel={primaryPanel}
        highlights={a.highlights ?? []}
        similarSeedProductId={a.productId}
        extraSections={bidHistory}
        tabs={[
          { id: "info", label: t("detail.tabInfo"), content: overviewTab },
          { id: "questions", label: t("detail.tabQuestions"), content: <ProductQuestions productId={a.productId} /> },
        ]}
        stickyAction={
          isLive ? (
            <Button onClick={scrollToBid} className="w-full justify-center gap-1.5">
              <Gavel className="h-4 w-4" />
              {t("bid.submit")}
            </Button>
          ) : (
            <Button disabled variant="secondary" className="w-full justify-center">
              {t(ds.statusKey as Parameters<typeof t>[0])}
            </Button>
          )
        }
      />
    </>
  )
}

function Stat({
  icon,
  label,
  value,
  small,
}: {
  icon: ReactNode
  label: string
  value: string
  small?: boolean
}) {
  return (
    <div className="bg-secondary/40 px-3 py-2.5">
      <dt className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className={`mt-1 font-bold tabular-nums ${small ? "text-xs font-medium" : "text-sm"}`}>{value}</dd>
    </div>
  )
}
