"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import confetti from "canvas-confetti"
import { motion } from "motion/react"
import { Gift, Users, Trophy, Clock, Check, ExternalLink, Loader2, Lock, PartyPopper } from "lucide-react"
import { toast } from "sonner"
import { apiPost, ApiError } from "@/lib/api-client"
import { Countdown } from "@/components/countdown"
import { formatNumber } from "@/lib/format"
import { useSession } from "@/hooks/use-session"
import { FadeItem } from "@/components/motion"

type Channel = { id: string; title: string; url: string }
type Winner = { position: number; name: string; username: string | null }

export type GiveawayDetailData = {
  id: string
  slug: string
  title: string
  subtitle: string | null
  description: string | null
  coverImage: string | null
  prizeImage: string | null
  prizeLabel: string
  winnersCount: number
  requiredChannels: Channel[]
  startAt: string
  endAt: string
  drawAt: string
  status: string
  participants: number
  entered: boolean
  winners: Winner[]
}

function fireConfetti() {
  const end = Date.now() + 900
  const colors = ["#e8b923", "#f5d76e", "#ffffff"]
  ;(function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0 }, colors })
    confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1 }, colors })
    if (Date.now() < end) requestAnimationFrame(frame)
  })()
}

export function GiveawayDetail({
  giveaway,
  onChange,
}: {
  giveaway: GiveawayDetailData
  onChange: () => void
}) {
  const { user } = useSession()
  const [joining, setJoining] = useState(false)
  const [missing, setMissing] = useState<Channel[]>([])
  const firedRef = useRef(false)

  const isActive = giveaway.status === "ACTIVE"
  const isScheduled = giveaway.status === "SCHEDULED"
  const isFinished = giveaway.status === "FINISHED"
  const isLocked = giveaway.status === "LOCKED" || giveaway.status === "DRAWING"

  // Celebrate once when a finished giveaway has winners revealed.
  useEffect(() => {
    if (isFinished && giveaway.winners.length > 0 && !firedRef.current) {
      firedRef.current = true
      fireConfetti()
    }
  }, [isFinished, giveaway.winners.length])

  async function handleJoin() {
    if (!user) return
    setJoining(true)
    setMissing([])
    try {
      const res = await apiPost<{ data: { joined: boolean; missing: Channel[] } }>(
        `/api/v1/giveaways/${giveaway.slug}/enter`,
      )
      if (res.data.joined) {
        toast.success("شرکت شما ثبت شد! موفق باشی")
        fireConfetti()
        onChange()
      } else {
        setMissing(res.data.missing)
        toast.error("برای شرکت، اول در کانال‌های زیر عضو شو")
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "خطا در ثبت شرکت")
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Hero */}
      <FadeItem>
        <div className="card-premium relative overflow-hidden rounded-3xl border border-primary/20">
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted sm:aspect-[2/1]">
            {giveaway.coverImage ? (
              <Image
                src={giveaway.coverImage || "/placeholder.svg"}
                alt={giveaway.title}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/40">
                <Gift className="h-20 w-20 text-primary/40" />
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5">
              <StatusBadge status={giveaway.status} />
              <h1 className="mt-2 text-balance text-2xl font-extrabold leading-tight">{giveaway.title}</h1>
              {giveaway.subtitle && (
                <p className="mt-1 text-sm text-muted-foreground">{giveaway.subtitle}</p>
              )}
            </div>
          </div>
        </div>
      </FadeItem>

      {/* Countdown + stats */}
      {!isFinished && (
        <FadeItem>
          <div className="grid grid-cols-2 gap-3">
            <div className="card-premium flex flex-col items-center justify-center gap-1 rounded-2xl border border-border p-4 text-center">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-[11px] text-muted-foreground">
                {isScheduled ? "شروع ثبت‌نام تا" : "قرعه‌کشی تا"}
              </span>
              <Countdown
                target={isScheduled ? giveaway.startAt : giveaway.drawAt}
                onComplete={onChange}
                className="text-lg font-extrabold text-gold"
              />
            </div>
            <div className="card-premium flex flex-col items-center justify-center gap-1 rounded-2xl border border-border p-4 text-center">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-[11px] text-muted-foreground">شرکت‌کنندگان</span>
              <span className="text-lg font-extrabold tabular-nums">{formatNumber(giveaway.participants)}</span>
            </div>
          </div>
        </FadeItem>
      )}

      {/* Prize */}
      <FadeItem>
        <div className="card-premium gold-border flex items-center gap-3 rounded-2xl p-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/30">
            <Trophy className="h-6 w-6 text-primary" />
          </span>
          <div className="min-w-0">
            <span className="text-[11px] text-muted-foreground">جایزه</span>
            <p className="truncate font-bold leading-6">{giveaway.prizeLabel}</p>
          </div>
          <span className="mr-auto shrink-0 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-gold">
            {giveaway.winnersCount} برنده
          </span>
        </div>
      </FadeItem>

      {/* Description */}
      {giveaway.description && (
        <FadeItem>
          <div className="card-premium rounded-2xl border border-border p-4">
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {giveaway.description}
            </p>
          </div>
        </FadeItem>
      )}

      {/* Required channels (always informative) */}
      {giveaway.requiredChannels.length > 0 && !isFinished && (
        <FadeItem>
          <div className="card-premium space-y-2.5 rounded-2xl border border-border p-4">
            <h2 className="text-sm font-bold">برای شرکت باید عضو این کانال‌ها باشی</h2>
            <div className="space-y-2">
              {giveaway.requiredChannels.map((c) => {
                const isMissing = missing.some((m) => m.id === c.id)
                return (
                  <a
                    key={c.id}
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={
                      "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors " +
                      (isMissing
                        ? "border-destructive/50 bg-destructive/10"
                        : "border-border bg-secondary/50 hover:border-primary/40")
                    }
                  >
                    <span className="font-medium">{c.title}</span>
                    <ExternalLink className="mr-auto h-4 w-4 text-muted-foreground" />
                  </a>
                )
              })}
            </div>
            {missing.length > 0 && (
              <p className="text-[11px] text-destructive">
                بعد از عضویت، دوباره دکمه شرکت را بزن.
              </p>
            )}
          </div>
        </FadeItem>
      )}

      {/* Entry CTA */}
      <FadeItem>
        <EntryCta
          giveaway={giveaway}
          loggedIn={!!user}
          joining={joining}
          onJoin={handleJoin}
          isActive={isActive}
          isScheduled={isScheduled}
          isLocked={isLocked}
          isFinished={isFinished}
        />
      </FadeItem>

      {/* Winners reveal */}
      {isFinished && (
        <FadeItem>
          <div className="card-premium gold-border space-y-3 rounded-2xl p-5">
            <h2 className="flex items-center gap-2 text-base font-extrabold">
              <PartyPopper className="h-5 w-5 text-primary" />
              برندگان قرعه‌کشی
            </h2>
            {giveaway.winners.length === 0 ? (
              <p className="text-sm text-muted-foreground">برنده‌ای ثبت نشده است.</p>
            ) : (
              <ul className="space-y-2">
                {giveaway.winners.map((w, i) => (
                  <motion.li
                    key={w.position}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.12 }}
                    className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-extrabold text-gold ring-1 ring-primary/30">
                      {w.position}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-bold leading-5">{w.name}</p>
                      {w.username && <p className="truncate text-xs text-muted-foreground">{w.username}</p>}
                    </div>
                    <Trophy className="mr-auto h-4 w-4 shrink-0 text-primary" />
                  </motion.li>
                ))}
              </ul>
            )}
          </div>
        </FadeItem>
      )}
    </div>
  )
}

function EntryCta({
  giveaway,
  loggedIn,
  joining,
  onJoin,
  isActive,
  isScheduled,
  isLocked,
  isFinished,
}: {
  giveaway: GiveawayDetailData
  loggedIn: boolean
  joining: boolean
  onJoin: () => void
  isActive: boolean
  isScheduled: boolean
  isLocked: boolean
  isFinished: boolean
}) {
  if (giveaway.entered && !isFinished) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-4 text-sm font-bold text-gold">
        <Check className="h-5 w-5" />
        شرکت شما ثبت شده است
      </div>
    )
  }

  if (isFinished) return null

  if (isScheduled) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-secondary/50 px-4 py-4 text-sm text-muted-foreground">
        <Clock className="h-5 w-5 text-primary" />
        ثبت‌نام هنوز شروع نشده است
      </div>
    )
  }

  if (isLocked) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-secondary/50 px-4 py-4 text-sm text-muted-foreground">
        <Lock className="h-5 w-5 text-primary" />
        ثبت‌نام بسته شده و قرعه‌کشی در راه است
      </div>
    )
  }

  if (!loggedIn) {
    return (
      <Link
        href="/login"
        className="bg-gold elevate-gold flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-bold text-primary-foreground"
      >
        برای شرکت وارد شو
      </Link>
    )
  }

  if (isActive) {
    return (
      <button
        type="button"
        onClick={onJoin}
        disabled={joining}
        className="bg-gold elevate-gold flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-bold text-primary-foreground disabled:opacity-60"
      >
        {joining ? <Loader2 className="h-5 w-5 animate-spin" /> : <Gift className="h-5 w-5" />}
        شرکت در قرعه‌کشی
      </button>
    )
  }

  return null
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; pulse?: boolean }> = {
    ACTIVE: { label: "در حال ثبت‌نام", cls: "bg-destructive text-white", pulse: true },
    SCHEDULED: { label: "به‌زودی", cls: "bg-primary/90 text-primary-foreground" },
    PAUSED: { label: "متوقف", cls: "bg-secondary text-muted-foreground" },
    LOCKED: { label: "بسته شد", cls: "bg-secondary text-muted-foreground" },
    DRAWING: { label: "در حال قرعه‌کشی", cls: "bg-primary/90 text-primary-foreground" },
    FINISHED: { label: "پایان‌یافته", cls: "bg-secondary text-muted-foreground" },
  }
  const m = map[status] ?? { label: status, cls: "bg-secondary text-muted-foreground" }
  return (
    <span className={"inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium " + m.cls}>
      {m.pulse && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
      {m.label}
    </span>
  )
}
