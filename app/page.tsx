"use client"

import Link from "next/link"
import useSWR from "swr"
import { ArrowLeft, Gavel, Zap, Wallet, Gift, Plus, ShoppingBag, BadgePercent } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { useI18n } from "@/components/i18n-provider"
import type { MessageKey } from "@/lib/i18n/messages"
import { AuctionCard, type AuctionSummary } from "@/components/auction-card"
import { FlashCard, type FlashSale } from "@/components/flash-card"
import { RecommendedRail } from "@/components/recommended-rail"
import { Stagger, FadeItem, Pressable } from "@/components/motion"
import { Button } from "@/components/ui/button"
import { MembershipBadge } from "@/components/membership-badge"

const quickActions: { href: string; label: MessageKey; icon: typeof Gavel }[] = [
  { href: "/auctions", label: "nav.auctions", icon: Gavel },
  { href: "/flash", label: "nav.flash", icon: Zap },
  { href: "/giveaways", label: "nav.giveaways", icon: Gift },
  { href: "/orders", label: "nav.orders", icon: ShoppingBag },
]

export default function HomePage() {
  const { user } = useSession()
  const { t, priceValue, currency } = useI18n()
  const { data: flashData, isLoading: flashLoading, mutate: mutateFlash } = useSWR<{
    data: FlashSale[]
  }>("/api/v1/flash-sales", fetcher, { refreshInterval: 10000 })
  const { data: auctionData, isLoading: auctionLoading } = useSWR<{ data: AuctionSummary[] }>(
    "/api/v1/auctions",
    fetcher,
    { refreshInterval: 8000 },
  )

  const flashSales = flashData?.data ?? []
  const auctions = auctionData?.data ?? []
  const liveAuctions = auctions.filter((a) => a.status === "ACTIVE" || a.status === "SCHEDULED")

  return (
    <Stagger className="space-y-7">
      {/* VIP balance hero */}
      <FadeItem>
        <section className="gold-border sheen surface-glow relative overflow-hidden p-5 shadow-xl shadow-primary/5">
          <div className="relative z-[2] flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-sm text-muted-foreground">
              {t("home.welcome")}{user?.displayName ? ` ${user.displayName}` : ""}
            </span>
            {user ? (
              <Link href="/rewards" className="shrink-0">
                <MembershipBadge tier={user.membership.tier} />
              </Link>
            ) : null}
          </div>

          {/* Tier discount perk hint (only when the tier unlocks a discount). */}
          {user && user.membership.discountPercent > 0 ? (
            <div className="relative z-[2] mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-gold">
              <BadgePercent className="h-3.5 w-3.5 text-primary" />
              {t("membership.discount").replace("{n}", String(user.membership.discountPercent))}
            </div>
          ) : null}

          <div className="relative z-[2] mt-5 flex items-center gap-2 text-xs text-muted-foreground">
            <Wallet className="h-4 w-4 text-primary" />
            {t("home.balance")}
          </div>
          <div className="relative z-[2] mt-1.5 flex items-baseline gap-1.5">
            <span className="text-gold min-w-0 truncate text-[clamp(1.7rem,8.5vw,2.6rem)] font-extrabold leading-none tabular-nums tracking-tight">
              {priceValue(user?.balances?.availableBalance ?? 0)}
            </span>
            <span className="shrink-0 text-sm text-muted-foreground">{currency}</span>
          </div>

          <div className="relative z-[2] mt-6 flex gap-2.5">
            <Button
              variant="gold"
              size="lg"
              className="flex-1"
              render={<Link href="/wallet" />}
            >
              <Plus className="h-4 w-4" strokeWidth={2.6} />
              {t("home.topup")}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="flex-1 border-primary/25 bg-secondary/50 font-bold backdrop-blur hover:border-primary/45"
              render={<Link href="/auctions" />}
            >
              <Gavel className="h-4 w-4 text-primary" />
              {t("nav.auctions")}
            </Button>
          </div>

          {/* Ambient floating gold orb for cinematic depth (decorative). */}
          <div
            aria-hidden
            className="animate-float pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl"
          />
        </section>
      </FadeItem>

      {/* Quick actions */}
      <FadeItem>
        <section className="grid grid-cols-4 gap-2.5">
          {quickActions.map((a) => (
            <Pressable key={a.href}>
              <Link
                href={a.href}
                className="card-premium group flex flex-col items-center gap-2 rounded-2xl border border-border p-3 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20 transition-all duration-300 group-hover:bg-primary/15 group-hover:ring-primary/40">
                  <a.icon className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
                </span>
                <span className="text-center text-[11px] font-medium leading-tight">{t(a.label)}</span>
              </Link>
            </Pressable>
          ))}
        </section>
      </FadeItem>

      {/* Personalized recommendations (hidden when there's nothing to show) */}
      <FadeItem>
        <RecommendedRail limit={4} />
      </FadeItem>

      {/* Live auctions */}
      <FadeItem>
        <Section
          title={t("home.liveAuctions")}
          icon={<Gavel className="h-5 w-5 text-primary" />}
          href="/auctions"
          viewAll={t("common.viewAll")}
        >
          {auctionLoading ? (
            <CardSkeletons />
          ) : liveAuctions.length === 0 ? (
            <Empty text={t("home.noAuctions")} />
          ) : (
            <div className="space-y-3">
              {liveAuctions.slice(0, 3).map((a) => (
                <AuctionCard key={a.id} auction={a} />
              ))}
            </div>
          )}
        </Section>
      </FadeItem>

      {/* Flash sales */}
      <FadeItem>
        <Section
          title={t("home.flashSales")}
          icon={<Zap className="h-5 w-5 text-primary" />}
          href="/flash"
          viewAll={t("common.viewAll")}
        >
          {flashLoading ? (
            <CardSkeletons />
          ) : flashSales.length === 0 ? (
            <Empty text={t("home.noFlash")} />
          ) : (
            <div className="space-y-3">
              {flashSales.slice(0, 3).map((s) => (
                <FlashCard key={s.id} sale={s} onPurchased={() => mutateFlash()} />
              ))}
            </div>
          )}
        </Section>
      </FadeItem>
    </Stagger>
  )
}

function Section({
  title,
  icon,
  href,
  viewAll,
  children,
}: {
  title: string
  icon: React.ReactNode
  href: string
  viewAll: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2.5 text-lg font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            {icon}
          </span>
          {title}
        </h2>
        <Link
          href={href}
          className="active:scale-press flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          {viewAll}
          <ArrowLeft className="h-3.5 w-3.5" />
        </Link>
      </div>
      {children}
    </section>
  )
}

function CardSkeletons() {
  return (
    <div className="space-y-3">
      {[0, 1].map((i) => (
        <div key={i} className="shimmer card-premium h-64 w-full rounded-2xl border border-border" />
      ))}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="card-premium rounded-2xl border border-dashed border-border/80 p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  )
}
