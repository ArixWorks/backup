"use client"

import useSWR from "swr"
import { Bell } from "lucide-react"
import { HeaderControl } from "@/components/header/control-button"
import { useI18n } from "@/components/i18n-provider"
import { useSession } from "@/hooks/use-session"
import { fetcher } from "@/lib/api-client"

interface NotifResponse {
  ok: boolean
  data: { unread: number }
}

/**
 * Header notifications shortcut — a glass bell that surfaces a live unread
 * badge. SWR dedupes the request with the profile sheet's identical key, so
 * this adds no extra network cost.
 */
export function NotificationBell() {
  const { t } = useI18n()
  const { user } = useSession()
  const { data } = useSWR<NotifResponse>(
    user ? "/api/v1/notifications?limit=1" : null,
    fetcher,
    { refreshInterval: 20000, revalidateOnFocus: true },
  )
  const unread = data?.data?.unread ?? 0

  return (
    <HeaderControl href="/notifications" aria-label={t("menu.notifications")}>
      <Bell className="h-[18px] w-[18px]" strokeWidth={1.9} />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground shadow-[0_0_8px_-1px_var(--primary)] ring-2 ring-card">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </HeaderControl>
  )
}
