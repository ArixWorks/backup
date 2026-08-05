"use client"

import Link from "next/link"
import useSWR from "swr"
import { CircuitBoard, Gift, Package, Plus, UserPlus } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import type { MessageKey } from "@/lib/i18n/messages"
import { Stagger, FadeItem, Pressable } from "@/components/motion"
import { ProfileBalanceHero } from "@/components/profile-balance-hero"
import { ServiceFolder, type ServiceFolderDef } from "@/components/home/service-folder"
import { apiGet } from "@/lib/api-client"
import type { HomePreviews } from "@/lib/home/service-previews"

const quickActions: { href: string; label: MessageKey; icon: typeof Plus }[] = [
  { href: "/wallet", label: "home.topup", icon: Plus },
  { href: "/orders", label: "nav.orders", icon: Package },
  { href: "/giveaways", label: "nav.giveaways", icon: Gift },
  { href: "/invite", label: "invite.title", icon: UserPlus },
]

/**
 * The four home services, each rendered as a folder that opens to show real
 * items. `key` maps the folder onto its bucket in the previews payload; VPS is
 * locked because there is nothing to sell there yet.
 */
const services: (ServiceFolderDef & { key: keyof HomePreviews })[] = [
  { key: "store", href: "/flash", title: "svc.store", desc: "svc.storeDesc", code: "MARKET", accent: "primary" },
  { key: "auctions", href: "/auctions", title: "svc.auctions", desc: "svc.auctionsDesc", code: "BID", accent: "warning" },
  { key: "domains", href: "/domains", title: "svc.domains", desc: "svc.domainsDesc", code: "DOMAIN", accent: "success" },
  { key: "vps", href: "/vps", title: "svc.vps", desc: "svc.vpsDesc", code: "CLOUD", accent: "accent", locked: true },
]

const EMPTY: HomePreviews = { store: [], auctions: [], domains: [], vps: [] }

export default function HomePage() {
  const { t, locale } = useI18n()

  // Locale is part of the key so switching language refetches localized titles.
  // Folders render closed while this is in flight, then fill in — the layout
  // never shifts because the folder graphic has a fixed height.
  const { data } = useSWR<{ data: HomePreviews }>(`/api/v1/home/previews?locale=${locale}`, apiGet, {
    revalidateOnFocus: false,
  })
  const previews = data?.data ?? EMPTY

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
            {services.map((service, index) => (
              <ServiceFolder key={service.href} service={service} items={previews[service.key]} index={index} />
            ))}
          </div>
        </section>
      </FadeItem>
    </Stagger>
  )
}
