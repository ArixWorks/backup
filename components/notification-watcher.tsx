"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { toast } from "sonner"
import { fetcher } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { playNotificationChime } from "@/lib/notification-sound"

interface NotificationItem {
  id: string
  title: string
  body: string
  href: string | null
  createdAt: string
}
interface NotifResponse {
  ok: boolean
  data: { items: NotificationItem[]; unread: number }
}

/**
 * Headless, app-wide notification watcher. Polls the notification feed and,
 * when genuinely new items arrive, plays a chime and surfaces a toast with a
 * deep link. Renders no UI — the notification controls themselves now live in
 * the profile sheet, but this keeps the real-time alerting always-on.
 */
export function NotificationWatcher() {
  const { user } = useSession()
  const router = useRouter()
  const lastSeenId = useRef<string | null>(null)
  const initialized = useRef(false)

  const { data } = useSWR<NotifResponse>(
    user ? "/api/v1/notifications?limit=10" : null,
    fetcher,
    { refreshInterval: 20000, revalidateOnFocus: true },
  )

  const items = data?.data?.items ?? []

  useEffect(() => {
    if (items.length === 0) return
    const newest = items[0]

    // First successful load: record baseline, don't alert for existing items.
    if (!initialized.current) {
      initialized.current = true
      lastSeenId.current = newest.id
      return
    }

    if (newest.id !== lastSeenId.current) {
      const idx = items.findIndex((n) => n.id === lastSeenId.current)
      const fresh = idx === -1 ? items : items.slice(0, idx)
      lastSeenId.current = newest.id

      playNotificationChime()
      const first = fresh[0]
      toast(first.title, {
        description:
          fresh.length > 1 ? `${first.body} (+${fresh.length - 1} اعلان دیگر)` : first.body,
        action: first.href
          ? { label: "مشاهده", onClick: () => router.push(first.href!) }
          : undefined,
      })
    }
  }, [items, router])

  return null
}
