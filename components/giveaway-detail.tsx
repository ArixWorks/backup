"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
// canvas-confetti is loaded lazily (only when a user actually wins) so its
// weight never lands in the giveaway page's initial bundle.
import { motion } from "motion/react"
import { Gift, Users, Trophy, Clock, Check, ExternalLink, Loader2, Lock, PartyPopper } from "lucide-react"
import { toast } from "sonner"
import { apiPost, ApiError } from "@/lib/api-client"
import { Countdown } from "@/components/countdown"
import { formatNumber } from "@/lib/format"
import { useSession } from "@/hooks/use-session"
import { FadeItem } from "@/components/motion"
import { RichContent } from "@/components/rich-content"
import { useI18n } from "@/components/i18n-provider"
import type { MessageKey } from "@/lib/i18n/messages"

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

async function fireConfetti() {
  // Respect users who prefer reduced motion — skip the animation entirely.
  if (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  ) {
    return
  }
  const { default: confetti } = await import("canvas-confetti")
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
  const { t } = useI18n()
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
      void fireConfetti()
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
        toast.success(t("gwd.entered"))
        void fireConfetti()
        onChange()
      } else {
        setMissing(res.data.missing)
        toast.error(t("gwd.joinChannelsFirst"))
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("gwd.errEnter"))
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
              <h1 dir="auto" className="mt-2 text-balance text-2xl font-extrabold leading-tight">{giveaway.title}</h1>
              {giveaway.subtitle && (
                <p dir="auto" className="mt-1 text-sm text-muted-foreground">{giveaway.subtitle}</p>
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
                {isScheduled ? t("gwd.startRegUntil") : t("gw.drawUntil")}
              </span>
              <Countdown
                target={isScheduled ? giveaway.startAt : giveaway.drawAt}
                onComplete={onChange}
                completedLabel={isScheduled ? t("gwStatus.ACTIVE") : undefined}
                className="text-lg font-extrabold text-gold"
              />
            </div>
            <div className="card-premium flex flex-col items-center justify-center gap-1 rounded-2xl border border-border p-4 text-center">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-[11px] text-muted-foreground">{t("gwd.participants")}</span>
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
            <span className="text-[11px] text-muted-foreground">{t("gwd.prize")}</span>
            <p dir="auto" className="truncate font-bold leading-6">{giveaway.prizeLabel}</p>
          </div>
          <span className="mr-auto shrink-0 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-gold">
            {t("gw.winnersCount", { count: giveaway.winnersCount })}
          </span>
        </div>
      </FadeItem>

      {/* Description */}
      {giveaway.description && (
        <FadeItem>
          <div className="card-premium rounded-2xl border border-border p-4">
            <RichContent content={giveaway.description} />
          </div>
        </FadeItem>
      )}

      {/* Required channels (always informative) */}
      {giveaway.requiredChannels.length > 0 && !isFinished && (
        <FadeItem>
          <div className="card-premium space-y-2.5 rounded-2xl border border-border p-4">
            <h2 className="text-sm font-bold">{t("gwd.mustJoin")}</h2>
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
                {t("gwd.afterJoinRetry")}
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
          t={t}
        />
      </FadeItem>

      {/* Winners reveal */}
      {isFinished && (
        <FadeItem>
          <div className="card-premium gold-border space-y-3 rounded-2xl p-5">
            <h2 className="flex items-center gap-2 text-base font-extrabold">
              <PartyPopper className="h-5 w-5 text-primary" />
              {t("gwd.winners")}
            </h2>
            {giveaway.winners.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("gwd.noWinners")}</p>
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
                      <p dir="auto" className="truncate font-bold leading-5">{w.name}</p>
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
  t,
}: {
  giveaway: GiveawayDetailData
  loggedIn: boolean
  joining: boolean
  onJoin: () => void
  isActive: boolean
  isScheduled: boolean
  isLocked: boolean
  isFinished: boolean
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
}) {
  if (giveaway.entered && !isFinished) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-4 text-sm font-bold text-gold">
        <Check className="h-5 w-5" />
        {t("gwd.alreadyEntered")}
      </div>
    )
  }

  if (isFinished) return null

  if (isScheduled) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-secondary/50 px-4 py-4 text-sm text-muted-foreground">
        <Clock className="h-5 w-5 text-primary" />
        {t("gwd.notStarted")}
      </div>
    )
  }

  if (isLocked) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-secondary/50 px-4 py-4 text-sm text-muted-foreground">
        <Lock className="h-5 w-5 text-primary" />
        {t("gwd.regClosed")}
      </div>
    )
  }

  if (!loggedIn) {
    return (
      <Link
        href="/login"
        className="bg-gold elevate-gold flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-bold text-primary-foreground"
      >
        {t("gwd.signInToEnter")}
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
        {t("gwd.enter")}
      </button>
    )
  }

  return null
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n()
  const map: Record<string, { labelKey: MessageKey; cls: string; pulse?: boolean }> = {
    ACTIVE: { labelKey: "gwStatus.ACTIVE", cls: "bg-destructive text-destructive-foreground", pulse: true },
    SCHEDULED: { labelKey: "gwStatus.SCHEDULED", cls: "bg-primary/90 text-primary-foreground" },
    PAUSED: { labelKey: "gwStatus.PAUSED", cls: "bg-secondary text-muted-foreground" },
    LOCKED: { labelKey: "gwStatus.LOCKED", cls: "bg-secondary text-muted-foreground" },
    DRAWING: { labelKey: "gwStatus.DRAWING", cls: "bg-primary/90 text-primary-foreground" },
    FINISHED: { labelKey: "gwStatus.FINISHED", cls: "bg-secondary text-muted-foreground" },
  }
  const m = map[status]
  const label = m ? t(m.labelKey) : status
  const cls = m?.cls ?? "bg-secondary text-muted-foreground"
  return (
    <span className={"inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium " + cls}>
      {m?.pulse && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive-foreground" />}
      {label}
    </span>
  )
}
