"use client"

import Link from "next/link"
import { ChevronLeft, CircuitBoard, Gavel, Gift, Globe, Package, Plus, Server, Store, UserPlus } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
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

const services: { href: string; icon: typeof Gavel; title: MessageKey; desc: MessageKey; badge: MessageKey; code: string }[] = [
  { href: "/flash", icon: Store, title: "svc.store", desc: "svc.storeDesc", badge: "badge.active", code: "MARKET" },
  { href: "/auctions", icon: Gavel, title: "svc.auctions", desc: "svc.auctionsDesc", badge: "badge.active", code: "BID" },
  { href: "/domains", icon: Globe, title: "svc.domains", desc: "svc.domainsDesc", badge: "badge.active", code: "DOMAIN" },
  { href: "/vps", icon: Server, title: "svc.vps", desc: "svc.vpsDesc", badge: "badge.soon", code: "CLOUD" },
]

function ServiceCard({ service, index }: { service: (typeof services)[number]; index: number }) {
  const { t } = useI18n()
  const reduceMotion = useReducedMotion()
  const Icon = service.icon

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: reduceMotion ? 0 : index * 0.07, type: "spring", stiffness: 220, damping: 24 }}
      className="h-full"
    >
      <Link href={service.href} className="service-node group relative flex min-h-28 h-full items-center gap-3.5 overflow-hidden rounded-[1.4rem] border border-border px-4 py-4 outline-none transition-[border-color,transform,box-shadow] duration-300 focus-visible:ring-2 focus-visible:ring-ring hoverable:hover:-translate-y-1 hoverable:hover:border-primary/45 hoverable:hover:shadow-[0_18px_42px_-24px_color-mix(in_oklab,var(--primary)_70%,transparent)] sm:min-h-32 sm:px-5">
        <span aria-hidden className="service-node__grid" />
        <span aria-hidden className="service-node__orbit" />
        <span aria-hidden className="service-node__beam" />

        <motion.span
          className="service-node__icon relative z-10 flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/[0.12] text-primary shadow-[inset_0_1px_0_color-mix(in_oklab,var(--foreground)_10%,transparent)] sm:size-14"
          whileHover={reduceMotion ? undefined : { rotate: index % 2 ? 6 : -6, scale: 1.08 }}
          transition={{ type: "spring", stiffness: 340, damping: 18 }}
        >
          <Icon className="size-5.5 sm:size-6" strokeWidth={2} />
          <span aria-hidden className="absolute -bottom-1 h-px w-7 bg-primary/80 blur-[1px]" />
        </motion.span>

        <span className="relative z-10 min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span dir="auto" className="text-pretty text-[15px] font-extrabold leading-6 text-foreground sm:text-base">{t(service.title)}</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-success/25 bg-success/[0.09] px-2 py-0.5 text-[9px] font-bold text-success">
              <span className="size-1.5 rounded-full bg-success shadow-[0_0_7px_color-mix(in_oklab,var(--success)_80%,transparent)]" />
              {t(service.badge)}
            </span>
          </span>
          <span dir="auto" className="mt-0.5 block text-pretty text-xs leading-5 text-muted-foreground sm:text-[13px]">{t(service.desc)}</span>
          <span aria-hidden className="mt-2 hidden font-mono text-[8px] font-semibold tracking-[0.2em] text-primary/50 sm:block">NODE / {service.code}</span>
        </span>

        <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-xl border border-border bg-background/35 text-muted-foreground transition-[color,border-color,transform] duration-300 group-hover:text-primary group-hover:border-primary/30 group-hover:-translate-x-1 rtl:group-hover:translate-x-1">
          <ChevronLeft className="size-4 rtl:rotate-180" />
        </span>
      </Link>
    </motion.article>
  )
}

export default function HomePage() {
  const { t } = useI18n()
  return (
    <Stagger className="flex flex-col gap-6">
      <FadeItem><ProfileBalanceHero /></FadeItem>

      <FadeItem>
        <section aria-label={t("home.quickActions")} className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] web:lg:mx-0 web:lg:grid web:lg:grid-cols-4 web:lg:overflow-visible web:lg:px-0 [&::-webkit-scrollbar]:hidden">
          {quickActions.map((action) => <Pressable key={action.href} className="snap-start web:lg:w-full"><Link href={action.href} className="card-premium group flex min-h-11 items-center gap-2 rounded-full border border-border px-4 py-2.5 transition-colors hover:border-primary/40 web:lg:justify-center"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20"><action.icon className="size-4" /></span><span className="whitespace-nowrap text-xs font-semibold">{t(action.label)}</span></Link></Pressable>)}
        </section>
      </FadeItem>

      <FadeItem>
        <section className="flex flex-col gap-3.5">
          <header className="flex items-center justify-between gap-3 px-1">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
                <CircuitBoard className="size-5" />
                <span aria-hidden className="absolute -bottom-1 size-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold leading-6 text-foreground">{t("home.servicesTitle")}</h2>
                <p className="text-[11px] text-muted-foreground">DIGITAL SERVICE NETWORK</p>
              </div>
            </div>
            <span aria-hidden className="h-px min-w-10 flex-1 bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--primary)_35%,transparent),transparent)]" />
          </header>

          <div className="grid gap-3 sm:grid-cols-2 web:xl:grid-cols-4">
            {services.map((service, index) => <ServiceCard key={service.href} service={service} index={index} />)}
          </div>
        </section>
      </FadeItem>
    </Stagger>
  )
}
