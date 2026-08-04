"use client"

import Lottie from "lottie-react"
import domainAnimation from "@/lib/lottie/domain.json"
import { cn } from "@/lib/utils"

/**
 * Domain celebration icon for successful domain-registration notifications.
 *
 * The animation JSON is STATICALLY imported so it is bundled into the same
 * chunk as the celebration overlay — it is in memory the moment the popup
 * mounts, with no network fetch or lazy-load pop-in.
 */
export function DomainLottie({ className }: { className?: string }) {
  return (
    <Lottie
      animationData={domainAnimation}
      loop
      autoplay
      rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
      className={cn("h-full w-full", className)}
      aria-hidden="true"
    />
  )
}
