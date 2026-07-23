"use client"

import confetti from "canvas-confetti"

/**
 * Celebration confetti orchestration built on canvas-confetti.
 *
 * canvas-confetti only understands hex colors (its internal color parser is
 * hex-only), so we use curated festive palettes here rather than the theme's
 * oklch tokens. The confetti canvas is transient, pointer-events:none, and
 * sits above the overlay (zIndex 200) so it rains over the whole viewport
 * without blocking the action button.
 *
 * NOTE: we deliberately do NOT set `disableForReducedMotion`. This is a brief,
 * one-shot, user-initiated reward moment (not ambient/looping motion), and many
 * targets — the Telegram in-app webview in particular — report reduced-motion
 * by default, which previously silenced the celebration entirely.
 */

const ENTRY_COLORS = ["#34d399", "#10b981", "#5eead4", "#fbbf24", "#ffffff"]
const WIN_COLORS = ["#fbbf24", "#f59e0b", "#fde68a", "#34d399", "#a78bfa", "#38bdf8", "#ffffff"]

const Z = 200

/** Lively, festive burst for entering a giveaway / completing a purchase. */
export function fireEntryConfetti() {
  // Center pop.
  confetti({
    particleCount: 110,
    spread: 90,
    startVelocity: 42,
    origin: { y: 0.62 },
    colors: ENTRY_COLORS,
    zIndex: Z,
  })
  // Side cannons sweeping inward from both edges.
  const end = Date.now() + 1100
  const frame = () => {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 60,
      startVelocity: 48,
      origin: { x: 0, y: 0.7 },
      colors: ENTRY_COLORS,
      zIndex: Z,
    })
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 60,
      startVelocity: 48,
      origin: { x: 1, y: 0.7 },
      colors: ENTRY_COLORS,
      zIndex: Z,
    })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}

/** Grand, sustained celebration for winning an auction or giveaway. */
export function fireWinConfetti() {
  // Big opening burst.
  confetti({
    particleCount: 180,
    spread: 110,
    startVelocity: 50,
    scalar: 1.15,
    origin: { y: 0.5 },
    colors: WIN_COLORS,
    zIndex: Z,
  })
  // Follow-up fireworks.
  window.setTimeout(() => {
    confetti({
      particleCount: 120,
      spread: 140,
      startVelocity: 42,
      origin: { y: 0.42 },
      colors: WIN_COLORS,
      zIndex: Z,
    })
  }, 380)
  // Sustained dual side cannons for a few seconds.
  const end = Date.now() + 3200
  const frame = () => {
    confetti({
      particleCount: 7,
      angle: 60,
      spread: 72,
      startVelocity: 60,
      origin: { x: 0, y: 0.64 },
      colors: WIN_COLORS,
      zIndex: Z,
    })
    confetti({
      particleCount: 7,
      angle: 120,
      spread: 72,
      startVelocity: 60,
      origin: { x: 1, y: 0.64 },
      colors: WIN_COLORS,
      zIndex: Z,
    })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}

/** Clear any in-flight confetti (call on unmount / close). */
export function resetConfetti() {
  try {
    confetti.reset()
  } catch {
    // ignore
  }
}
