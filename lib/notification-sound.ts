"use client"

const MUTE_KEY = "v0:notif-muted"

/** Whether notification sounds are muted (persisted in localStorage). */
export function isNotifMuted(): boolean {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(MUTE_KEY) === "1"
}

/** Persist the mute preference. */
export function setNotifMuted(muted: boolean) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0")
}

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctor) return null
    if (!audioCtx) audioCtx = new Ctor()
    return audioCtx
  } catch {
    return null
  }
}

/**
 * Play a short, pleasant two-note chime using the Web Audio API. No audio asset
 * required. Respects the mute preference and silently no-ops if audio is
 * unavailable or blocked (e.g. before the first user gesture).
 */
export function playNotificationChime() {
  if (isNotifMuted()) return
  const ctx = getCtx()
  if (!ctx) return
  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => {})
    const now = ctx.currentTime
    // Two ascending notes: G5 then C6.
    const notes = [
      { freq: 784, start: 0, dur: 0.16 },
      { freq: 1047, start: 0.12, dur: 0.22 },
    ]
    for (const n of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.value = n.freq
      const t0 = now + n.start
      // Quick attack, smooth exponential decay.
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t0)
      osc.stop(t0 + n.dur + 0.02)
    }
  } catch {
    // ignore
  }
}

/** Unlock/resume the audio context on a user gesture (call once on first click). */
export function primeAudio() {
  const ctx = getCtx()
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {})
}
