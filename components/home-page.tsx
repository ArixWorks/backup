"use client"

import Link from "next/link"
import { ChevronLeft, Gavel, Gift, Globe, Package, Plus, Server, Store, UserPlus } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import type { MessageKey } from "@/lib/i18n/messages"
import { Stagger, FadeItem, Pressable } from "@/components/motion"
import { ProfileBalanceHero } from "@/components/profile-balance-hero"

const quickActions: { href: string; label: MessageKey; icon: typeof Plus }[] = [
  { href: "/wallet", label: "home.topup", icon: Plus },
  { href: "/orders", label: "nav.orders", icon: Package },
  { href: "/giveaways", label: "nav.giveaways", icon: Gift },
  { href: "/invite", label: "invite.title", icon: UserPlus },
]

const secondaryServices: { href: string; icon: typeof Gavel; title: MessageKey; desc: MessageKey; badge: MessageKey }[] = [
  { href: "/auctions", icon: Gavel, title: "svc.auctions", desc: "svc.auctionsDesc", badge: "badge.active" },
  { href: "/domains", icon: Globe, title: "svc.domains", desc: "svc.domainsDesc", badge: "badge.active" },
  { href: "/vps", icon: Server, title: "svc.vps", desc: "svc.vpsDesc", badge: "badge.soon" },
]

export default function HomePage() {
  const { t } = useI18n()
  return (
    <Stagger className="flex flex-col gap-7">
      <FadeItem><ProfileBalanceHero /></FadeItem>

      <FadeItem>
        <section aria-label={t("home.quickActions")} className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] web:lg:mx-0 web:lg:grid web:lg:grid-cols-4 web:lg:overflow-visible web:lg:px-0 [&::-webkit-scrollbar]:hidden">
          {quickActions.map((action) => <Pressable key={action.href} className="snap-start web:lg:w-full"><Link href={action.href} className="card-premium group flex min-h-11 items-center gap-2 rounded-full border border-border px-4 py-2.5 transition-colors hover:border-primary/40 web:lg:justify-center"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20"><action.icon className="size-4" /></span><span className="whitespace-nowrap text-xs font-semibold">{t(action.label)}</span></Link></Pressable>)}
        </section>
      </FadeItem>

      <FadeItem>
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2.5 text-lg font-bold"><span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20"><Store className="size-5 text-primary" /></span>{t("home.servicesTitle")}</h2>
          <div className="grid gap-3 web:lg:grid-cols-5">
            <Link href="/flash" className="group relative flex min-h-48 flex-col justify-between overflow-hidden rounded-3xl border border-primary/30 bg-primary/10 p-5 transition-colors hover:bg-primary/15 web:lg:col-span-2 web:lg:row-span-2">
              <div className="flex items-start justify-between gap-3"><span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-gold)]"><Store className="size-7" /></span><span className="rounded-full border border-success/30 bg-success/10 px-2 py-1 text-[10px] font-bold text-success">{t("badge.active")}</span></div>
              <div><div className="flex items-center gap-2"><h3 className="text-xl font-extrabold">{t("svc.store")}</h3><ChevronLeft className="size-5 text-primary transition-transform group-hover:-translate-x-1 rtl:rotate-180 rtl:group-hover:translate-x-1" /></div><p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{t("svc.storeDesc")}</p></div>
            </Link>

            <div className="grid gap-3 sm:grid-cols-3 web:lg:col-span-3 web:lg:grid-cols-1">
              {secondaryServices.map((service) => <Link key={service.href} href={service.href} className="group flex min-h-28 items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><service.icon className="size-5" /></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="font-bold">{t(service.title)}</h3><span className="rounded-full bg-secondary px-2 py-0.5 text-[9px] font-bold text-muted-foreground">{t(service.badge)}</span></div><p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{t(service.desc)}</p></div><ChevronLeft className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-1 rtl:rotate-180 rtl:group-hover:translate-x-1" /></Link>)}
            </div>
          </div>
        </section>
      </FadeItem>
    </Stagger>
  )
}
