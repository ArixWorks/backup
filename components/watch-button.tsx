"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Bell, BellRing, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fetcher, apiPost, apiDelete, ApiError } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"

export function WatchButton({
  auctionId,
  className,
}: {
  auctionId: string
  className?: string
}) {
  const { user } = useSession()
  const { t, errorMessage } = useI18n()
  const [loading, setLoading] = useState(false)
  const key = user ? `/api/v1/auctions/${auctionId}/watch` : null
  const { data, mutate } = useSWR<{ ok: boolean; data: { watching: boolean } }>(key, fetcher)
  const watching = data?.data?.watching ?? false

  async function toggle() {
    if (!user) return toast.error(t("buy.loginFirst"))
    setLoading(true)
    try {
      if (watching) {
        await apiDelete(`/api/v1/auctions/${auctionId}/watch`)
        toast.success(t("watch.auctionRemoved"))
      } else {
        await apiPost(`/api/v1/auctions/${auctionId}/watch`)
        toast.success(t("watch.auctionAdded"))
      }
      await mutate()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant={watching ? "default" : "secondary"}
      onClick={toggle}
      disabled={loading}
      className={cn("gap-2", className)}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : watching ? (
        <BellRing className="h-4 w-4" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
      {watching ? t("watch.watching") : t("watch.watchAuction")}
    </Button>
  )
}
