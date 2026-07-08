"use client"

import { AnimatePresence } from "motion/react"
import { useSession } from "@/hooks/use-session"
import { BannedOverlay } from "@/components/auth/banned-overlay"

/**
 * Global watcher that seals off the entire app the moment the signed-in user is
 * banned. `useSession` polls /api/v1/auth/session every 15s (and on reconnect),
 * so an admin ban propagates to the user's open web app within seconds — the
 * BannedOverlay then covers every section with a blocking, animated notice.
 *
 * Mounted once at the provider level so it applies everywhere (storefront,
 * Mini App and any other route) regardless of the current screen.
 */
export function BannedGate() {
  const { user } = useSession()
  const isBanned = user?.status === "BANNED"

  return <AnimatePresence>{isBanned && <BannedOverlay key="banned" />}</AnimatePresence>
}
