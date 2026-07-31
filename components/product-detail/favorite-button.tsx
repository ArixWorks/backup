"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Heart, Loader2 } from "lucide-react"
import { fetcher, apiPost, apiDelete } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"

/**
 * Circular "like"/favorite toggle designed to float over the product hero
 * image (glass button matching the back/share controls). Persists to the
 * per-user Favorite table via /api/v1/favorites/[productId]. Optimistically
 * flips the heart and reconciles with the server on response.
 */
export function FavoriteButton({
  productId,
  className,
}: {
  productId: string
  className?: string
}) {
  const { user } = useSession()
  const { t, errorMessage } = useI18n()
  const [loading, setLoading] = useState(false)
  const key = user ? `/api/v1/favorites/${productId}` : null
  const { data, mutate } = useSWR<{ ok: boolean; data: { favorited: boolean } }>(key, fetcher)
  const favorited = data?.data?.favorited ?? false

  async function toggle() {
    if (!user) return toast.error(t("buy.loginFirst"))
    setLoading(true)
    // Optimistic flip.
    await mutate({ ok: true, data: { favorited: !favorited } }, { revalidate: false })
    try {
      if (favorited) {
        await apiDelete(`/api/v1/favorites/${productId}`)
        toast.success(t("detail.favoriteRemoved"))
      } else {
        await apiPost(`/api/v1/favorites/${productId}`)
        toast.success(t("detail.favoriteAdded"))
      }
      await mutate()
    } catch (err) {
      await mutate()
      toast.error(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      aria-pressed={favorited}
      aria-label={favorited ? t("detail.favoriteActive") : t("detail.favorite")}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md transition-colors",
        favorited
          ? "border-destructive/40 bg-destructive/15 text-destructive"
          : "border-border/50 bg-background/60 text-foreground hover:bg-background/80",
        className,
      )}
    >
      {loading ? (
        <Loader2 className="h-[18px] w-[18px] animate-spin" />
      ) : (
        <Heart className={cn("h-[18px] w-[18px]", favorited && "fill-current")} />
      )}
    </button>
  )
}
