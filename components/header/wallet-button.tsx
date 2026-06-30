"use client"

import { Wallet } from "lucide-react"
import { HeaderControl } from "@/components/header/control-button"
import { useI18n } from "@/components/i18n-provider"

/**
 * Header wallet shortcut — a glass icon button routing to the wallet. Kept
 * icon-only (per the Golden Design Reference) so the control cluster stays
 * minimal; the full balance lives on the wallet hero.
 */
export function WalletButton() {
  const { t } = useI18n()
  return (
    <HeaderControl href="/wallet" aria-label={t("nav.wallet")}>
      <Wallet className="h-[18px] w-[18px]" strokeWidth={1.9} />
    </HeaderControl>
  )
}
