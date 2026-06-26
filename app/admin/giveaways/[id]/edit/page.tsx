"use client"

import { use } from "react"
import Link from "next/link"
import useSWR from "swr"
import { ChevronRight, Gift } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { Skeleton } from "@/components/ui/skeleton"
import { GiveawayForm, emptyGiveaway, type GiveawayFormValues } from "@/components/admin/giveaway-form"

// Convert an ISO timestamp into the value format expected by datetime-local.
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type DetailGiveaway = {
  title: string
  subtitle: string | null
  description: string | null
  coverImage: string | null
  prizeImage: string | null
  prizeLabel: string
  prizeKind: GiveawayFormValues["prizeKind"]
  prizeAmount: string | null
  prizeProductId: string | null
  couponType: "PERCENT" | "FIXED" | null
  couponValue: string | null
  couponExpiresInDays: number | null
  winnersCount: number
  requiredChannels: { id: string; title: string; url: string }[] | null
  startAt: string
  endAt: string
  drawAt: string
  visibility: GiveawayFormValues["visibility"]
  autoDraw: boolean
  internalNotes: string | null
}

export default function EditGiveawayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, isLoading } = useSWR<{ data: { giveaway: DetailGiveaway } }>(
    `/api/v1/admin/giveaways/${id}`,
    fetcher,
  )
  const g = data?.data.giveaway

  const initial: GiveawayFormValues | null = g
    ? {
        ...emptyGiveaway,
        title: g.title,
        subtitle: g.subtitle ?? "",
        description: g.description ?? "",
        coverImage: g.coverImage ?? "",
        prizeImage: g.prizeImage ?? "",
        prizeLabel: g.prizeLabel,
        prizeKind: g.prizeKind,
        prizeAmount: g.prizeAmount ? String(g.prizeAmount) : "",
        prizeProductId: g.prizeProductId ?? "",
        couponType: g.couponType ?? "PERCENT",
        couponValue: g.couponValue ? String(g.couponValue) : "",
        couponExpiresInDays: g.couponExpiresInDays ? String(g.couponExpiresInDays) : "",
        winnersCount: String(g.winnersCount),
        requiredChannels: g.requiredChannels ?? [],
        startAt: toLocalInput(g.startAt),
        endAt: toLocalInput(g.endAt),
        drawAt: toLocalInput(g.drawAt),
        visibility: g.visibility,
        autoDraw: g.autoDraw,
        internalNotes: g.internalNotes ?? "",
      }
    : null

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/giveaways" className="hover:text-foreground">
          قرعه‌کشی‌ها
        </Link>
        <ChevronRight className="h-4 w-4 rotate-180" />
        <Link href={`/admin/giveaways/${id}`} className="hover:text-foreground">
          {g?.title ?? "..."}
        </Link>
        <ChevronRight className="h-4 w-4 rotate-180" />
        <span className="text-foreground">ویرایش</span>
      </div>
      <div className="flex items-center gap-2">
        <Gift className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-extrabold">ویرایش قرعه‌کشی</h1>
      </div>
      {isLoading || !initial ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : (
        <GiveawayForm initial={initial} giveawayId={id} />
      )}
    </div>
  )
}
