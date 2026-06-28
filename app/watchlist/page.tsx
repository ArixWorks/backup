"use client"

import useSWR from "swr"
import { BellRing, Zap } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { AuctionCard, type AuctionSummary } from "@/components/auction-card"
import { WatchedProducts } from "@/components/watched-products"
import { EmptyState, SignInRequired } from "@/components/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { useSession } from "@/hooks/use-session"

export default function WatchlistPage() {
  const { user } = useSession()
  const { data, isLoading } = useSWR<{ data: AuctionSummary[] }>(
    user ? "/api/v1/watchlist" : null,
    fetcher,
    { refreshInterval: 8000 },
  )
  const auctions = data?.data ?? []

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-extrabold">
          <BellRing className="h-5 w-5 text-primary" />
          لیست پیگیری
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          مزایده‌هایی که دنبال می‌کنید؛ هنگام شروع هر مزایده به شما اطلاع داده می‌شود.
        </p>
      </header>

      {!user ? (
        <SignInRequired description="برای مشاهده لیست پیگیری، ابتدا وارد حساب کاربری خود شوید." />
      ) : (
        <div className="space-y-7">
          {/* Watched auctions */}
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <BellRing className="h-4 w-4 text-primary" />
              مزایده‌ها
            </h2>
            {isLoading ? (
              <div className="space-y-3">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="h-64 w-full rounded-2xl" />
                ))}
              </div>
            ) : auctions.length === 0 ? (
              <EmptyState
                icon={BellRing}
                title="هنوز مزایده‌ای را پیگیری نمی‌کنید"
                description="مزایده‌های موردعلاقه‌تان را دنبال کنید تا هنگام شروع، باخبر شوید."
                actionLabel="مشاهده مزایده‌ها"
                actionHref="/auctions"
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {auctions.map((a) => (
                  <AuctionCard key={a.id} auction={a} />
                ))}
              </div>
            )}
          </section>

          {/* Watched flash products (back-in-stock alerts) */}
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Zap className="h-4 w-4 text-primary" />
              محصولات فروش فوری
            </h2>
            <WatchedProducts />
          </section>
        </div>
      )}
    </div>
  )
}
