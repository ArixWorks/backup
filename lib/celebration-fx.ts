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
 */

const ENTRY_COLORS = ["#34d399", "#10b981", "#5eead4", "#fbbf24", "#ffffff"]
const WIN_COLORS = ["#fbbf24", "#f59e0b", "#fde68a", "#34d399", "#a78bfa", "#38bdf8", "#ffffff"]

const Z = 200

/** Modest, tasteful burst for entering a giveaway / completing a purchase. */
export function fireEntryConfetti() {
  // Center pop.
  confetti({
    particleCount: 70,
    spread: 74,
    startVelocity: 38,
    origin: { y: 0.62 },
    colors: ENTRY_COLORS,
    zIndex: Z,
    disableForReducedMotion: true,
  })
  // Quick side cannons sweeping inward from both edges.
  const end = Date.now() + 700
  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      startVelocity: 45,
      origin: { x: 0, y: 0.7 },
      colors: ENTRY_COLORS,
      zIndex: Z,
      disableForReducedMotion: true,
    })
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      startVelocity: 45,
      origin: { x: 1, y: 0.7 },
      colors: ENTRY_COLORS,
      zIndex: Z,
      disableForReducedMotion: true,
    })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}

/** Grand, sustained celebration for winning an auction or giveaway. */
export function fireWinConfetti() {
  // Big opening burst.
  confetti({
    particleCount: 150,
    spread: 100,
    startVelocity: 48,
    scalar: 1.1,
    origin: { y: 0.5 },
    colors: WIN_COLORS,
    zIndex: Z,
    disableForReducedMotion: true,
  })
  // Follow-up fireworks.
  window.setTimeout(() => {
    confetti({
      particleCount: 100,
      spread: 130,
      startVelocity: 40,
      origin: { y: 0.42 },
      colors: WIN_COLORS,
      zIndex: Z,
      disableForReducedMotion: true,
    })
  }, 380)
  // Sustained dual side cannons for a couple of seconds.
  const end = Date.now() + 2400
  const frame = () => {
    confetti({
      particleCount: 6,
      angle: 60,
      spread: 68,
      startVelocity: 58,
      origin: { x: 0, y: 0.64 },
      colors: WIN_COLORS,
      zIndex: Z,
      disableForReducedMotion: true,
    })
    confetti({
      particleCount: 6,
      angle: 120,
      spread: 68,
      startVelocity: 58,
      origin: { x: 1, y: 0.64 },
      colors: WIN_COLORS,
      zIndex: Z,
      disableForReducedMotion: true,
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
