"use client"

import Link from "next/link"
import {
  BadgePercent,
  ChevronLeft,
  Crown,
  Gavel,
  Gift,
  Globe,
  LifeBuoy,
  Package,
  Plus,
  Server,
  ShieldCheck,
  Store,
  UserPlus,
  Wallet,
} from "lucide-react"
import { useSession } from "@/hooks/use-session"
import { useI18n } from "@/components/i18n-provider"
import type { MessageKey } from "@/lib/i18n/messages"
import { RecommendedRail } from "@/components/recommended-rail"
import { Stagger, FadeItem, Pressable, Tilt } from "@/components/motion"
import { MembershipBadge } from "@/components/membership-badge"
import { tierLabelKey } from "@/lib/tiers"

type Badge = { label: MessageKey; tone: "soon" | "active" }

type Service = {
  href: string
  icon: typeof Store
  title: MessageKey
  desc: MessageKey
  badge?: Badge
}

/**
 * The dashboard is a *hub*, not a shop. It maps the whole platform: each module
 * has exactly one card here. Products live only inside the Store, auctions only
 * inside Auctions, wallet only inside the Wallet tab / header pill.
 */
const services: Service[] = [
  { href: "/flash", icon: Store, title: "svc.store", desc: "svc.storeDesc", badge: { label: "badge.active", tone: "active" } },
  { href: "/auctions", icon: Gavel, title: "svc.auctions", desc: "svc.auctionsDesc" },
  { href: "/domains", icon: Globe, title: "svc.domains", desc: "svc.domainsDesc", badge: { label: "badge.soon", tone: "soon" } },
  { href: "/vps", icon: Server, title: "svc.vps", desc: "svc.vpsDesc", badge: { label: "badge.soon", tone: "soon" } },
  { href: "/giveaways", icon: Gift, title: "svc.giveaways", desc: "svc.giveawaysDesc" },
  { href: "/orders", icon: Package, title: "svc.orders", desc: "svc.ordersDesc" },
  { href: "/rewards", icon: Crown, title: "svc.rewards", desc: "svc.rewardsDesc" },
  { href: "/support", icon: LifeBuoy, title: "svc.support", desc: "svc.supportDesc" },
]

const quickActions: { href: string; label: MessageKey; icon: typeof Plus }[] = [
  { href: "/wallet", label: "home.topup", icon: Plus },
  { href: "/orders", label: "nav.orders", icon: Package },
  { href: "/giveaways", label: "nav.giveaways", icon: Gift },
  { href: "/invite", label: "invite.title", icon: UserPlus },
]

export default function HomePage() {
  const { user } = useSession()
  const { t, priceValue, currency } = useI18n()

  const discount = user?.membership?.discountPercent ?? 0

  return (
    <Stagger className="space-y-7">
      {/* ── Welcome hero: wallet summary + membership + account status ── */}
      <FadeItem>
        <Tilt max={5} glare className="rounded-[var(--radius)]">
          <section className="gold-border sheen surface-glow relative overflow-hidden p-5 shadow-xl shadow-primary/5 [transform-style:preserve-3d]">
            <div className="relative z-[2] flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm text-muted-foreground">
                {t("home.welcome")}
                {user?.displayName ? ` ${user.displayName}` : ""}
              </span>
              {user ? (
                <Link href="/rewards" className="shrink-0">
                  <MembershipBadge tier={user.membership.tier} />
                </Link>
              ) : null}
            </div>

            {discount > 0 ? (
              <div className="relative z-[2] mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-gold">
                <BadgePercent className="h-3.5 w-3.5 text-primary" />
                {t("membership.discount").replace("{n}", String(discount))}
              </div>
            ) : null}

            {/* Balance summary — the single dashboard representation of the
                wallet. Tapping it opens the Wallet tab (one clear entry). */}
            <Link
              href="/wallet"
              className="active:scale-press relative z-[2] mt-5 block [transform:translateZ(40px)]"
              aria-label={t("nav.wallet")}
            >
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Wallet className="h-4 w-4 text-primary" />
                {t("home.balance")}
              </span>
              <span className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-gold min-w-0 truncate text-[clamp(1.7rem,8.5vw,2.6rem)] font-extrabold leading-none tabular-nums tracking-tight">
                  {priceValue(user?.balances?.availableBalance ?? 0)}
                </span>
                <span className="shrink-0 text-sm text-muted-foreground">{currency}</span>
              </span>
            </Link>

            {/* Account status pill */}
            <div className="relative z-[2] mt-4 flex items-center gap-2 [transform:translateZ(20px)]">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                {t("home.accountStatus")}
                {user ? (
                  <span className="font-bold text-foreground">
                    {t(tierLabelKey(user.membership.tier) as MessageKey)}
                  </span>
                ) : null}
              </span>
            </div>

            <div
              aria-hidden
              className="animate-float pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl"
            />
          </section>
        </Tilt>
      </FadeItem>

      {/* ── Quick actions (frequent tasks) ── */}
      <FadeItem>
        <section
          aria-label={t("home.quickActions")}
          className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {quickActions.map((a) => (
            <Pressable key={a.href} className="snap-start">
              <Link
                href={a.href}
                className="card-premium group flex items-center gap-2 rounded-full border border-border px-4 py-2.5 transition-colors hover:border-primary/40"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20 transition-colors group-hover:bg-primary/15">
                  <a.icon className="h-4 w-4" />
                </span>
                <span className="whitespace-nowrap text-xs font-semibold">{t(a.label)}</span>
              </Link>
            </Pressable>
          ))}
        </section>
      </FadeItem>

      {/* ── Primary services (the platform map) ── */}
      <FadeItem>
        <section className="space-y-3">
          <h2 className="flex items-center gap-2.5 text-lg font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
              <Store className="h-5 w-5 text-primary" />
            </span>
            {t("home.servicesTitle")}
          </h2>

          <div className="grid grid-cols-2 gap-3">
            {services.map((s) => (
              <Tilt key={s.href} max={9} className="rounded-2xl">
                <Pressable className="h-full">
                  <Link
                    href={s.href}
                    className="card-premium group flex h-full flex-col gap-2.5 rounded-2xl border border-border p-4 [transform-style:preserve-3d] transition-all duration-300 hover:border-primary/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20 transition-all duration-300 [transform:translateZ(26px)] group-hover:bg-primary/15 group-hover:ring-primary/40">
                        <s.icon className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
                      </span>
                      {s.badge ? <StatusBadge label={t(s.badge.label)} tone={s.badge.tone} /> : null}
                    </div>
                    <div className="[transform:translateZ(14px)]">
                      <p className="text-sm font-bold text-foreground">{t(s.title)}</p>
                      <p className="mt-0.5 text-pretty text-[11px] leading-relaxed text-muted-foreground">
                        {t(s.desc)}
                      </p>
                    </div>
                  </Link>
                </Pressable>
              </Tilt>
            ))}
          </div>
        </section>
      </FadeItem>

      {/* ── Featured promotion (single banner) ── */}
      <FadeItem>
        <Link
          href="/flash"
          className="card-premium group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-primary/30 bg-primary/5 p-4 transition-colors hover:border-primary/50"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/25">
            <BadgePercent className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-foreground">{t("home.promoTitle")}</p>
            <p className="text-pretty text-xs leading-relaxed text-muted-foreground">
              {t("home.promoBody")}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">
            {t("home.promoCta")}
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl"
          />
        </Link>
      </FadeItem>

      {/* ── Personalized recommendations (self-hides when empty) ── */}
      <FadeItem>
        <RecommendedRail limit={4} />
      </FadeItem>
    </Stagger>
  )
}

function StatusBadge({ label, tone }: { label: string; tone: "soon" | "active" }) {
  return (
    <span
      className={
        tone === "soon"
          ? "shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-500"
          : "shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500"
      }
    >
      {label}
    </span>
  )
}
