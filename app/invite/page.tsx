"use client"

import useSWR from "swr"
import { Gift, UserCheck, ShoppingBag, Infinity as InfinityIcon } from "lucide-react"
import { ReferralCard } from "@/components/referral-card"
import { ReferralActivity, type ReferralItem } from "@/components/invite/referral-activity"
import { useSession } from "@/hooks/use-session"
import { fetcher } from "@/lib/api-client"
import { SignInRequired } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { useI18n } from "@/components/i18n-provider"

type ReferralData = {
  recent?: ReferralItem[]
}

const STAGES = [
  { icon: UserCheck, titleKey: "invite.s1.title", descKey: "invite.s1.desc" },
  { icon: ShoppingBag, titleKey: "invite.s2.title", descKey: "invite.s2.desc" },
  { icon: InfinityIcon, titleKey: "invite.s3.title", descKey: "invite.s3.desc" },
] as const

export default function InvitePage() {
  const { user } = useSession()
  const { t } = useI18n()
  const { data, isLoading } = useSWR<{ data: ReferralData }>(
    user ? "/api/v1/referral" : null,
    fetcher,
  )
  const recent = data?.data?.recent ?? []

  return (
    <div className="space-y-5">
      <PageHeader icon={Gift} title={t("invite.title")} description={t("invite.subtitle")} />

      {!user ? (
        <SignInRequired description={t("invite.signInRequired")} />
      ) : (
        <>
          <ReferralCard />

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-foreground">{t("invite.how")}</h2>
            <ol className="flex flex-col gap-2">
              {STAGES.map((s, i) => {
                const Icon = s.icon
                return (
                  <li
                    key={i}
                    className="flex items-start gap-3 rounded-xl border border-border bg-card/50 p-3"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {`${i + 1}. ${t(s.titleKey)}`}
                      </p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{t(s.descKey)}</p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-foreground">{t("invite.recent")}</h2>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            ) : (
              <ReferralActivity items={recent} />
            )}
          </section>
        </>
      )}
    </div>
  )
}
