"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Gift, Copy, Check, Users, UserCheck, Wallet, Send } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { formatToman } from "@/lib/format"
import { Skeleton } from "@/components/ui/skeleton"
import { useI18n } from "@/components/i18n-provider"

type ReferralData = {
  code: string
  totalReferred: number
  rewardedReferred: number
  joinedReferred: number
  totalEarned: string | number
  botUsername: string | null
}

/** True when running inside the Telegram Mini App webview. */
function getTelegramWebApp() {
  if (typeof window === "undefined") return undefined
  const wa = window.Telegram?.WebApp
  return wa && wa.initData ? wa : undefined
}

export function ReferralCard() {
  const { t } = useI18n()
  const { data, isLoading } = useSWR<{ data: ReferralData }>("/api/v1/referral", fetcher)
  const [copied, setCopied] = useState(false)
  const ref = data?.data

  // Smart link: inside Telegram (or whenever the bot username is known) hand out
  // the in-bot deep link so taps open the bot directly; on the plain web fall
  // back to the site link that captures ?ref= on first visit.
  const { link, isBotLink } = useMemo(() => {
    if (!ref) return { link: "", isBotLink: false }
    const inTelegram = !!getTelegramWebApp()
    if (ref.botUsername && (inTelegram || true)) {
      return { link: `https://t.me/${ref.botUsername}?start=ref_${ref.code}`, isBotLink: true }
    }
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    return { link: `${origin}/?ref=${ref.code}`, isBotLink: false }
  }, [ref])

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast.success(t("referral.copied"))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t("referral.copyFailed"))
    }
  }

  function share() {
    if (!link) return
    const text = t("referral.shareText")
    const wa = getTelegramWebApp()
    // Native Telegram forward sheet when inside the Mini App.
    if (wa?.openTelegramLink) {
      wa.openTelegramLink(
        `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`,
      )
      return
    }
    // Web Share API elsewhere, with a copy fallback.
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title: t("referral.shareTitle"), text, url: link }).catch(() => {})
      return
    }
    copy()
  }

  const earned = ref ? formatToman(ref.totalEarned ?? 0) : "0"

  return (
    <div className="card-premium gold-border relative overflow-hidden rounded-2xl border border-primary/30 p-5">
      {/* Decorative gold glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/10 blur-2xl"
      />
      <h2 className="relative z-[1] mb-1 flex items-center gap-2 font-bold">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
          <Gift className="h-4 w-4" />
        </span>
        {t("referral.title")}
      </h2>
      <p className="relative z-[1] mb-4 text-xs leading-relaxed text-muted-foreground">
        {t("referral.desc")}{" "}
        <strong className="text-foreground">{t("referral.descEachPurchase")}</strong>
      </p>

      {isLoading ? (
        <Skeleton className="h-10 w-full rounded-lg" />
      ) : (
        <>
          <div className="relative z-[1] flex items-center gap-2">
            <div className="flex-1 truncate rounded-lg border border-border bg-background/60 px-3 py-2.5 font-mono text-xs text-muted-foreground">
              {link}
            </div>
            <button
              type="button"
              onClick={copy}
              aria-label={t("referral.copyAria")}
              className="active:scale-press inline-flex shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5 text-primary transition-colors hover:bg-primary/15"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          <button
            type="button"
            onClick={share}
            className="active:scale-press bg-gold elevate-gold relative z-[1] mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-primary-foreground"
          >
            <Send className="h-4 w-4" />
            {isBotLink ? t("referral.sendTelegram") : t("referral.shareLink")}
          </button>

          <div className="relative z-[1] mt-4 grid grid-cols-3 gap-2">
            <Stat icon={Users} label={t("referral.statReferred")} value={ref?.totalReferred ?? 0} />
            <Stat icon={UserCheck} label={t("referral.statActive")} value={ref?.joinedReferred ?? 0} accent />
            <Stat icon={Wallet} label={t("referral.statEarned")} value={earned} accent />
          </div>
        </>
      )}
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Users
  label: string
  value: number | string
  accent?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-background/50 px-2 py-3 text-center">
      <Icon className={accent ? "h-4 w-4 text-primary" : "h-4 w-4 text-muted-foreground"} />
      <span
        className={
          accent
            ? "text-gold text-sm font-extrabold tabular-nums"
            : "text-sm font-extrabold tabular-nums text-foreground"
        }
      >
        {value}
      </span>
      <span className="text-[10px] leading-none text-muted-foreground">{label}</span>
    </div>
  )
}
