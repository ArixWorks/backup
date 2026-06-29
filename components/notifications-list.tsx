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
  Search,
  Archive,
  ArchiveRestore,
  Trash2,
  TrendingDown,
  Ticket,
  Crown,
  Award,
  Target,
  Coins,
  AlertTriangle,
  X,
} from "lucide-react"
import { useState } from "react"
import { fetcher, apiPost, apiDelete } from "@/lib/api-client"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/empty-state"
import { formatRelative } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"
import type { MessageKey } from "@/lib/i18n/messages"

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

// Icon per notification type. Falls back to a bell for anything unmapped.
const ICONS: Record<string, typeof Bell> = {
  GENERAL: Bell,
  BACK_IN_STOCK: PackageCheck,
  NEW_PRODUCT: Gift,
  ORDER_DELIVERED: PackageCheck,
  AUCTION_STARTED: Gavel,
  AUCTION_ENDING: Gavel,
  AUCTION_OUTBID: Gavel,
  AUCTION_LOST: Gavel,
  AUCTION_WON: Trophy,
  GIVEAWAY_STARTED: Gift,
  GIVEAWAY_WON: Trophy,
  DEPOSIT_APPROVED: Wallet,
  WITHDRAW_APPROVED: Wallet,
  REFUND_RECEIVED: Wallet,
  LOW_BALANCE: AlertTriangle,
  CASHBACK: BadgePercent,
  PRICE_DROP: TrendingDown,
  COUPON_ACTIVE: Ticket,
  COUPON_EXPIRING: Ticket,
  REFERRAL_BONUS: Gift,
  VIP_EXPIRING: Crown,
  VIP_UPGRADED: Crown,
  POINTS_EARNED: Coins,
  BADGE_AWARDED: Award,
  MISSION_COMPLETE: Target,
}

type Tab = "all" | "unread" | "archived"

const TABS: { key: Tab; labelKey: MessageKey }[] = [
  { key: "all", labelKey: "notifList.tabAll" },
  { key: "unread", labelKey: "notifList.tabUnread" },
  { key: "archived", labelKey: "notifList.tabArchived" },
]

export function NotificationsList() {
  const { t } = useI18n()
  const router = useRouter()
  const [marking, setMarking] = useState(false)
  const [tab, setTab] = useState<Tab>("all")
  const [search, setSearch] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)

  // Build the query string from the active tab + search term.
  const params = new URLSearchParams()
  if (tab === "unread") params.set("unread", "1")
  if (tab === "archived") params.set("archived", "1")
  if (search.trim()) params.set("q", search.trim())
  const key = `/api/v1/notifications?${params.toString()}`

  const { data, isLoading, mutate } = useSWR<{
    data: { items: NotificationItem[]; unread: number }
  }>(key, fetcher, { refreshInterval: 20000 })

  const items = data?.data?.items ?? []
  const unread = data?.data?.unread ?? 0

  async function open(n: NotificationItem) {
    if (!n.read) {
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

  async function archive(id: string) {
    setBusyId(id)
    try {
      await apiPost(`/api/v1/notifications/${id}/archive`).catch(() => {})
      await mutate()
    } finally {
      setBusyId(null)
    }
  }

  async function unarchive(id: string) {
    setBusyId(id)
    try {
      await apiDelete(`/api/v1/notifications/${id}/archive`).catch(() => {})
      await mutate()
    } finally {
      setBusyId(null)
    }
  }

  async function remove(id: string) {
    setBusyId(id)
    try {
      await apiDelete(`/api/v1/notifications/${id}`).catch(() => {})
      await mutate()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-xl bg-secondary/50 p-1">
        {TABS.map((tabItem) => (
          <button
            key={tabItem.key}
            type="button"
            onClick={() => setTab(tabItem.key)}
            className={cn(
              "flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
              tab === tabItem.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(tabItem.labelKey)}
            {tabItem.key === "unread" && unread > 0 && (
              <span className="ms-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                {unread}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search + mark-all */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("notifList.searchPlaceholder")}
            className="pe-3 ps-9"
          />
        </div>
        {unread > 0 && tab !== "archived" && (
          <button
            type="button"
            onClick={markAll}
            disabled={marking}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-primary hover:bg-secondary/40 disabled:opacity-50"
          >
            {marking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
            {t("notifList.markAll")}
          </button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={search.trim() ? Search : tab === "archived" ? Archive : tab === "unread" ? CheckCheck : Bell}
          title={
            search.trim()
              ? t("notifList.emptySearch")
              : tab === "archived"
                ? t("notifList.emptyArchived")
                : tab === "unread"
                  ? t("notifList.emptyUnread")
                  : t("notifList.emptyAll")
          }
          description={
            !search.trim() && tab === "all" ? t("notifList.emptyAllDesc") : undefined
          }
        />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const Icon = ICONS[n.type] ?? Bell
            const isArchived = tab === "archived"
            return (
              <li
                key={n.id}
                className={cn(
                  "group relative flex items-stretch gap-3 rounded-2xl border p-3 transition-colors",
                  n.read
                    ? "border-border bg-card"
                    : "border-primary/30 bg-primary/5",
                )}
              >
                <button
                  type="button"
                  onClick={() => open(n)}
                  className="active:scale-press flex min-w-0 flex-1 items-start gap-3 text-right"
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

                {/* Per-item actions */}
                <div className="flex flex-col items-center justify-center gap-1">
                  {busyId === n.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : isArchived ? (
                    <>
                      <button
                        type="button"
                        onClick={() => unarchive(n.id)}
                        aria-label={t("notifList.restore")}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <ArchiveRestore className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(n.id)}
                        aria-label={t("notifList.delete")}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => archive(n.id)}
                        aria-label={t("notifList.archive")}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <Archive className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(n.id)}
                        aria-label={t("notifList.delete")}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
