"use client"

import { useRouter } from "next/navigation"
import useSWR from "swr"
import Image from "next/image"
import {
  Bell,
  PackageCheck,
  Gavel,
  Trophy,
  Wallet,
  BadgePercent,
  Gift,
  CheckCheck,
  Loader2,
} from "lucide-react"
import { useState } from "react"
import { fetcher, apiPost } from "@/lib/api-client"
import { Skeleton } from "@/components/ui/skeleton"
import { formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"

interface NotificationItem {
  id: string
  type: string
  title: string
  body: string
  href: string | null
  image: string | null
  read: boolean
  createdAt: string
}

const ICONS: Record<string, typeof Bell> = {
  GENERAL: Bell,
  BACK_IN_STOCK: PackageCheck,
  ORDER_DELIVERED: PackageCheck,
  AUCTION_STARTED: Gavel,
  AUCTION_WON: Trophy,
  DEPOSIT_APPROVED: Wallet,
  WITHDRAW_APPROVED: Wallet,
  CASHBACK: BadgePercent,
  REFERRAL_BONUS: Gift,
}

export function NotificationsList() {
  const router = useRouter()
  const [marking, setMarking] = useState(false)
  const { data, isLoading, mutate } = useSWR<{
    data: { items: NotificationItem[]; unread: number }
  }>("/api/v1/notifications", fetcher, { refreshInterval: 20000 })

  const items = data?.data?.items ?? []
  const unread = data?.data?.unread ?? 0

  async function open(n: NotificationItem) {
    if (!n.read) {
      // Optimistically mark read, then persist.
      mutate(
        (cur) =>
          cur && {
            ...cur,
            data: {
              unread: Math.max(0, cur.data.unread - 1),
              items: cur.data.items.map((i) => (i.id === n.id ? { ...i, read: true } : i)),
            },
          },
        false,
      )
      await apiPost(`/api/v1/notifications/${n.id}/read`).catch(() => {})
      mutate()
    }
    if (n.href) router.push(n.href)
  }

  async function markAll() {
    setMarking(true)
    try {
      await apiPost("/api/v1/notifications")
      await mutate()
    } finally {
      setMarking(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        هنوز اعلانی ندارید. وقتی خبری باشد اینجا نمایش داده می‌شود.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {unread > 0 && (
        <button
          type="button"
          onClick={markAll}
          disabled={marking}
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-50"
        >
          {marking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
          خواندن همه ({unread})
        </button>
      )}

      <ul className="space-y-2">
        {items.map((n) => {
          const Icon = ICONS[n.type] ?? Bell
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => open(n)}
                className={cn(
                  "active:scale-press flex w-full items-start gap-3 rounded-2xl border p-3 text-right transition-colors",
                  n.read
                    ? "border-border bg-card hover:bg-secondary/40"
                    : "border-primary/30 bg-primary/5 hover:bg-primary/10",
                )}
              >
                {n.image ? (
                  <Image
                    src={n.image || "/placeholder.svg"}
                    alt=""
                    width={48}
                    height={48}
                    className="h-12 w-12 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold">{n.title}</span>
                    {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </div>
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{n.body}</p>
                  <span className="text-[11px] text-muted-foreground/70">{formatRelative(n.createdAt)}</span>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
