"use client"

import useSWR from "swr"
import { Gift, UserCheck, ShoppingBag, Infinity as InfinityIcon } from "lucide-react"
import { ReferralCard } from "@/components/referral-card"
import { ReferralActivity, type ReferralItem } from "@/components/invite/referral-activity"
import { useSession } from "@/hooks/use-session"
import { fetcher } from "@/lib/api-client"
import { SignInRequired } from "@/components/empty-state"
import { Skeleton } from "@/components/ui/skeleton"

type ReferralData = {
  recent?: ReferralItem[]
}

const STAGES = [
  {
    icon: UserCheck,
    title: "دوستت عضو می‌شود",
    desc: "وقتی دوستت با لینک تو وارد ربات شود و عضویت را کامل کند، پاداش اول را می‌گیری.",
  },
  {
    icon: ShoppingBag,
    title: "اولین خرید دوستت",
    desc: "با نخستین خرید دوستت، هم تو و هم او پاداش ویژه‌ی خرید اول را دریافت می‌کنید.",
  },
  {
    icon: InfinityIcon,
    title: "درآمد دائمی",
    desc: "از این پس بابت هر خرید دوستت، درصدی اعتبار به‌صورت همیشگی نصیب تو می‌شود.",
  },
]

export default function InvitePage() {
  const { user } = useSession()
  const { data, isLoading } = useSWR<{ data: ReferralData }>(
    user ? "/api/v1/referral" : null,
    fetcher,
  )
  const recent = data?.data?.recent ?? []

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-extrabold">
          <Gift className="h-5 w-5 text-primary" />
          دعوت دوستان
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          دوستانت را دعوت کن و در سه مرحله پاداش بگیر؛ از عضویت تا هر خرید آن‌ها.
        </p>
      </header>

      {!user ? (
        <SignInRequired description="برای دریافت لینک دعوت، ابتدا وارد حساب کاربری خود شوید." />
      ) : (
        <>
          <ReferralCard />

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-foreground">چطور پاداش می‌گیرم؟</h2>
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
                        {`${i + 1}. ${s.title}`}
                      </p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{s.desc}</p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-foreground">دعوت‌های اخیر</h2>
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
