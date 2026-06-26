"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Bell, BellRing, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fetcher, apiPost, apiDelete, ApiError } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { cn } from "@/lib/utils"

/**
 * Subscribe to a flash product's back-in-stock alert. Shown when the product is
 * sold out so visitors can opt in to be notified when it returns.
 */
export function ProductWatchButton({
  productId,
  className,
}: {
  productId: string
  className?: string
}) {
  const { user } = useSession()
  const [loading, setLoading] = useState(false)
  const key = user ? `/api/v1/product-watch/${productId}` : null
  const { data, mutate } = useSWR<{ ok: boolean; data: { watching: boolean } }>(key, fetcher)
  const watching = data?.data?.watching ?? false

  async function toggle() {
    if (!user) return toast.error("ابتدا یک حساب کاربری انتخاب کنید")
    setLoading(true)
    try {
      if (watching) {
        await apiDelete(`/api/v1/product-watch/${productId}`)
        toast.success("اطلاع‌رسانی موجودی لغو شد")
      } else {
        await apiPost(`/api/v1/product-watch/${productId}`)
        toast.success("هنگام موجود شدن محصول به شما اطلاع می‌دهیم")
      }
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "خطا در به‌روزرسانی اطلاع‌رسانی")
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
      className={cn("w-full gap-2", className)}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : watching ? (
        <BellRing className="h-4 w-4" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
      {watching ? "اطلاع‌رسانی فعال است" : "به من اطلاع بده"}
    </Button>
  )
}
