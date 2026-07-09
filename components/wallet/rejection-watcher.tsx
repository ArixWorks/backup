"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { XCircle } from "lucide-react"
import { fetcher, apiPost } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useI18n } from "@/components/i18n-provider"

type Notif = {
  id: string
  title: string
  body: string
  createdAt: string
}

// Pull the admin-supplied reason out of the stored notification body
// ("… دلیل: <reason>" / "… reason: <reason>") so we can surface it on its own line.
function extractReason(body: string): string | null {
  const m = body.match(/(?:دلیل|reason|причина)\s*[:：]\s*([\s\S]+)$/i)
  return m ? m[1].trim() : null
}

/**
 * Polls for unread DEPOSIT_REJECTED notifications and surfaces them as a blocking
 * alert. Dismissing marks the notification read (server-side) so it never repeats.
 * The detailed history lives in <RequestsPanel/>; this is the attention-grabbing nudge.
 */
export function RejectionWatcher({ onAcknowledged }: { onAcknowledged?: () => void }) {
  const { t } = useI18n()
  const { data, mutate } = useSWR<{ data: { items: Notif[] } }>(
    "/api/v1/notifications?type=DEPOSIT_REJECTED&unread=1&limit=5",
    fetcher,
    { refreshInterval: 15000, revalidateOnFocus: true },
  )

  const [active, setActive] = useState<Notif | null>(null)
  const [busy, setBusy] = useState(false)

  const next = data?.data.items?.[0] ?? null
  useEffect(() => {
    if (next && !active) setActive(next)
  }, [next, active])

  async function dismiss() {
    if (!active) return
    setBusy(true)
    try {
      await apiPost(`/api/v1/notifications/${active.id}/read`, {})
    } catch {
      // Ignore: worst case the alert reappears on next poll.
    } finally {
      setBusy(false)
      setActive(null)
      mutate()
      onAcknowledged?.()
    }
  }

  const reason = active ? extractReason(active.body) : null

  return (
    <Dialog open={!!active} onOpenChange={(v) => !v && dismiss()}>
      <DialogContent showCloseButton={false} className="max-w-sm rounded-3xl p-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <XCircle className="h-9 w-9 text-destructive" />
          </span>
          <DialogTitle className="text-lg font-bold text-balance">{t("wallet.rejectedTitle")}</DialogTitle>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            {t("wallet.rejectedBody")}
          </p>
          {reason && (
            <p className="w-full rounded-xl bg-destructive/5 px-3 py-2 text-start text-sm leading-relaxed text-destructive">
              <span className="font-bold">{t("wallet.rejectReasonLabel")}: </span>
              {reason}
            </p>
          )}
          <Button onClick={dismiss} disabled={busy} className="mt-2 h-12 w-full text-base font-bold">
            {t("wallet.gotIt")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
