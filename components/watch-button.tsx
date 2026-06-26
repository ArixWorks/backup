"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Bell, BellRing, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fetcher, apiPost, apiDelete, ApiError } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { cn } from "@/lib/utils"

export function WatchButton({
  auctionId,
  className,
}: {
  auctionId: string
  className?: string
}) {
  const { user } = useSession()
  const [loading, setLoading] = useState(false)
  const key = user ? `/api/v1/auctions/${auctionId}/watch` : null
  const { data, mutate } = useSWR<{ ok: boolean; data: { watching: boolean } }>(key, fetcher)
  const watching = data?.data?.watching ?? false

  async function toggle() {
    if (!user) return toast.error("ابتدا یک حساب کاربری انتخاب کنید")
    setLoading(true)
    try {
      if (watching) {
        await apiDelete(`/api/v1/auctions/${auctionId}/watch`)
        toast.success("از لیست پیگیری حذف شد")
      } else {
        await apiPost(`/api/v1/auctions/${auctionId}/watch`)
        toast.success("به لیست پیگیری اضافه شد؛ هنگام شروع مزایده باخبر می‌شوید")
      }
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در به‌روزرسانی لیست پیگیری")
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
      {watching ? "در حال پیگیری" : "پیگیری مزایده"}
    </Button>
  )
}
