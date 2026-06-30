"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Bell, BellRing, Loader2 } from "lucide-react"
import { fetcher, apiPost, apiDelete, ApiError } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { cn } from "@/lib/utils"
import { chipBase } from "@/components/ui/chip"
import { useI18n } from "@/components/i18n-provider"

/**
 * Follow a product category to receive a (sound) notification whenever a new
 * product is added to it. Compact pill styled to sit beside the active
 * category filter.
 */
export function CategoryFollowButton({ category }: { category: string }) {
  const { user } = useSession()
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const enc = encodeURIComponent(category)
  const key = user && category ? `/api/v1/category-follow/${enc}` : null
  const { data, mutate } = useSWR<{ ok: boolean; data: { following: boolean } }>(key, fetcher)
  const following = data?.data?.following ?? false

  async function toggle() {
    if (!user) return toast.error(t("buy.loginFirst"))
    setLoading(true)
    try {
      if (following) {
        await apiDelete(`/api/v1/category-follow/${enc}`)
        toast.success(t("catFollow.unfollowed", { category }))
      } else {
        await apiPost(`/api/v1/category-follow/${enc}`)
        toast.success(t("catFollow.followed", { category }))
      }
      await mutate()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("catFollow.errUpdate"))
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      aria-pressed={following}
      className={cn(
        chipBase,
        "font-bold",
        following
          ? "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-accent)]"
          : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground",
      )}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : following ? (
        <BellRing className="h-3.5 w-3.5" />
      ) : (
        <Bell className="h-3.5 w-3.5" />
      )}
      {following ? t("catFollow.following") : t("catFollow.follow")}
    </button>
  )
}
