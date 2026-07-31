"use client"

import Lottie from "lottie-react"
import entryAnimation from "@/lib/lottie/giftbox-entry.json"
import winAnimation from "@/lib/lottie/giftbox-win.json"
import { cn } from "@/lib/utils"

/**
 * Gift-box celebration icon for lottery (giveaway) notifications.
 *
 * The animation JSON is STATICALLY imported so it is bundled into the same
 * chunk as the celebration overlay — it lives in memory the moment the popup
 * mounts, with no network fetch or lazy-load delay (the previous circular image
 * had to be downloaded, which caused the visible pop-in the user reported).
 *
 * - `entry` → gift box opening (shown when a user JOINS a lottery)
 * - `win`   → jackpot gift box (shown when a user WINS a lottery)
 */
export function GiftboxLottie({
  kind,
  className,
}: {
  kind: "entry" | "win"
  className?: string
}) {
  const animationData = kind === "win" ? winAnimation : entryAnimation
  return (
    <Lottie
      animationData={animationData}
      loop
      autoplay
      // Play from in-memory data right away; no async player boot delay.
      rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
      className={cn("h-full w-full", className)}
      aria-hidden="true"
    />
  )
}
