"use client"

import { useState } from "react"
import { Clock, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { useI18n } from "@/components/i18n-provider"
import { orderCopy } from "@/lib/i18n/order-copy"
import { CANCEL_REASON_CODES } from "@/lib/orders/shared"

/**
 * Shown when the admin requested more time (status AWAITING_EXTENSION_APPROVAL).
 * "Yes" extends the timer; "No" reveals the cancellation-reason picker and,
 * on confirm, cancels the order + refunds the exact principal to the wallet.
 */
export function ExtensionPrompt({
  minutes,
  refundAmountLabel,
  onApprove,
  onReject,
  busy,
}: {
  minutes: number
  refundAmountLabel: string
  onApprove: () => void
  onReject: (reasonCode: string, reason: string) => void
  busy: boolean
}) {
  const { locale } = useI18n()
  const c = orderCopy(locale)
  const [declining, setDeclining] = useState(false)
  const [reasonCode, setReasonCode] = useState<string>(CANCEL_REASON_CODES[0])
  const [reason, setReason] = useState("")

  return (
    <div className="rounded-2xl border-2 border-warning/40 bg-warning/5 p-4">
      <div className="flex items-start gap-2">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
        <div>
          <h3 className="font-bold">{c.extensionTitle}</h3>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">{c.extensionBody(minutes)}</p>
        </div>
      </div>

      {!declining ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={onApprove} disabled={busy} className="flex-1 gap-2">
            <Check className="h-4 w-4" />
            {c.extensionYes}
          </Button>
          <Button onClick={() => setDeclining(true)} disabled={busy} variant="outline" className="flex-1 gap-2">
            <X className="h-4 w-4" />
            {c.extensionNo}
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-medium">{c.cancelReasonLabel}</p>
          <RadioGroup value={reasonCode} onValueChange={setReasonCode} className="space-y-1.5">
            {CANCEL_REASON_CODES.map((code) => (
              <div key={code} className="flex items-center gap-2">
                <RadioGroupItem value={code} id={`rc-${code}`} />
                <Label htmlFor={`rc-${code}`} className="cursor-pointer font-normal">
                  {c.reasons[code]}
                </Label>
              </div>
            ))}
          </RadioGroup>
          {reasonCode === "OTHER" && (
            <Textarea
              dir="auto"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={c.cancelReasonPlaceholder}
            />
          )}
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{c.refundNote(refundAmountLabel)}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => onReject(reasonCode, reason)}
              disabled={busy || (reasonCode === "OTHER" && !reason.trim())}
              variant="destructive"
              className="flex-1"
            >
              {c.cancelConfirm}
            </Button>
            <Button onClick={() => setDeclining(false)} disabled={busy} variant="ghost" className="flex-1">
              {c.cancelBack}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
