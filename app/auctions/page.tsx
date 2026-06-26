"use client"

import useSWR from "swr"
import { Gavel } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { AuctionCard, type AuctionSummary } from "@/components/auction-card"
import { Skeleton } from "@/components/ui/skeleton"

export default function AuctionsPage() {
  const { data, isLoading } = useSWR<{ data: AuctionSummary[] }>("/api/v1/auctions", fetcher, {
    refreshInterval: 8000,
  })
  const auctions = data?.data ?? []

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-extrabold">
          <Gavel className="h-5 w-5 text-primary" />
          مزایده‌ها
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          روی محصولات دیجیتال پیشنهاد بدهید؛ مبلغ پیشنهاد تا پایان مزایده مسدود می‌شود.
        </p>
      </header>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64 w-full rounded-2xl" />
          ))}
        </div>
      ) : auctions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          مزایده‌ای یافت نشد.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {auctions.map((a) => (
            <AuctionCard key={a.id} auction={a} />
          ))}
        </div>
      )}
    </div>
  )
}
