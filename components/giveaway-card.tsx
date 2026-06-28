"use client"

import Link from "next/link"
import Image from "next/image"
import { Gift, Users, Trophy } from "lucide-react"
import { Countdown } from "@/components/countdown"
import { Badge } from "@/components/ui/badge"
import { formatNumber } from "@/lib/format"

export type GiveawaySummary = {
  id: string
  slug: string
  title: string
  subtitle: string | null
  coverImage: string | null
  prizeLabel: string
  winnersCount: number
  status: string
  startAt: string
  endAt: string
  drawAt: string
  _count?: { entries: number }
}

const STATUS: Record<string, { label: string; tone: "live" | "soon" | "done" | "locked" }> = {
  ACTIVE: { label: "در حال ثبت‌نام", tone: "live" },
  SCHEDULED: { label: "به‌زودی", tone: "soon" },
  PAUSED: { label: "متوقف", tone: "soon" },
  LOCKED: { label: "بسته شد", tone: "locked" },
  DRAWING: { label: "در حال قرعه‌کشی", tone: "locked" },
  FINISHED: { label: "پایان‌یافته", tone: "done" },
}

export function GiveawayCard({ giveaway }: { giveaway: GiveawaySummary }) {
  const meta = STATUS[giveaway.status] ?? { label: giveaway.status, tone: "soon" as const }
  const isActive = giveaway.status === "ACTIVE"
  const isScheduled = giveaway.status === "SCHEDULED"
  const isFinished = giveaway.status === "FINISHED"
  const participants = giveaway._count?.entries ?? 0

  return (
    <Link
      href={`/giveaways/${giveaway.slug}`}
      className="active:scale-press card-premium group flex flex-col overflow-hidden rounded-2xl border border-border transition-all duration-300 hover:-translate-y-1 hover:border-primary/45 hover:elevate-lg"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
        {giveaway.coverImage ? (
          <Image
            src={giveaway.coverImage || "/placeholder.svg"}
            alt={giveaway.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/15 to-secondary/40">
            <Gift className="h-12 w-12 text-primary/50" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card/85 via-transparent to-transparent" />
        <div className="absolute right-3 top-3">
          <Badge
            variant={meta.tone === "live" ? "destructive" : meta.tone === "soon" ? "default" : "secondary"}
            className="gap-1 rounded-full"
          >
            {meta.tone === "live" && (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
            )}
            {meta.label}
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1">
          <h3 className="line-clamp-1 font-bold leading-6">{giveaway.title}</h3>
          {giveaway.subtitle && (
            <p className="line-clamp-1 text-xs text-muted-foreground">{giveaway.subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-2 text-xs">
          <Trophy className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="line-clamp-1 font-medium text-foreground">{giveaway.prizeLabel}</span>
          <span className="mr-auto shrink-0 text-muted-foreground">{giveaway.winnersCount} برنده</span>
        </div>

        <div className="mt-auto flex items-end justify-between gap-2">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {formatNumber(participants)} شرکت‌کننده
          </span>
          <div className="text-left">
            <span className="text-[11px] text-muted-foreground">
              {isScheduled ? "شروع تا" : isFinished ? "قرعه‌کشی شد" : "قرعه‌کشی تا"}
            </span>
            <div className="text-sm font-medium">
              {isFinished ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <Countdown target={isScheduled ? giveaway.startAt : giveaway.drawAt} />
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
