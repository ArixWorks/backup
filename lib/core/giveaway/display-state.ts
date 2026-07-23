/**
 * Pure, presentation-only computation of a giveaway's current lifecycle phase.
 *
 * This mirrors the auction display-state helper: it turns the raw giveaway
 * schedule + status into a single "phase" plus the countdown target (if any)
 * and an i18n label key. It is deliberately side-effect free so both the
 * server (SSR label) and the client (live countdown) can call it.
 *
 * Phases:
 *  - BEFORE_START   : published, entries not open yet   -> counts down to startAt
 *  - ACCEPTING      : entries open                       -> counts down to endAt
 *  - PAUSED         : frozen by admin                    -> no countdown
 *  - ENDED_AUTO     : entries closed, auto-draw pending  -> no countdown ("draw soon")
 *  - ENDED_MANUAL   : entries closed, awaiting admin     -> no countdown
 *  - DRAWING        : draw in progress                   -> no countdown
 *  - FINISHED       : winners drawn                       -> no countdown
 *  - CANCELLED      : cancelled                           -> no countdown
 */
export type GiveawayPhase =
  | "BEFORE_START"
  | "ACCEPTING"
  | "PAUSED"
  | "ENDED_AUTO"
  | "ENDED_MANUAL"
  | "DRAWING"
  | "FINISHED"
  | "CANCELLED"

export type GiveawayStatusLike =
  | "DRAFT"
  | "SCHEDULED"
  | "ACTIVE"
  | "PAUSED"
  | "LOCKED"
  | "DRAWING"
  | "FINISHED"
  | "CANCELLED"

export interface GiveawayScheduleInput {
  status: GiveawayStatusLike
  startAt: string | Date
  endAt: string | Date
  drawAt: string | Date
  autoDraw: boolean
  pausedAt?: string | Date | null
  extendedAt?: string | Date | null
}

export interface GiveawayDisplayState {
  phase: GiveawayPhase
  /** ISO string the countdown ticks toward, or null when the timer is stopped. */
  target: string | null
  /** i18n key for the small caption above the countdown ("... until X"). */
  captionKey: string
  /** i18n key for the big status line shown when there is no live countdown. */
  statusKey: string
  /** Whether an admin extended the registration window (drives a small banner). */
  extended: boolean
}

function toDate(v: string | Date): Date {
  return typeof v === "string" ? new Date(v) : v
}

/**
 * Compute the display state. `now` is injectable for deterministic tests and to
 * let the client pass its own clock; defaults to the current time.
 */
export function computeGiveawayDisplayState(
  g: GiveawayScheduleInput,
  now: Date = new Date(),
): GiveawayDisplayState {
  const start = toDate(g.startAt)
  const end = toDate(g.endAt)
  const t = now.getTime()
  const extended = Boolean(g.extendedAt)

  if (g.status === "CANCELLED") {
    return { phase: "CANCELLED", target: null, captionKey: "gwPhase.caption.ended", statusKey: "gwPhase.cancelled", extended }
  }
  if (g.status === "FINISHED") {
    return { phase: "FINISHED", target: null, captionKey: "gwPhase.caption.ended", statusKey: "gwPhase.finished", extended }
  }
  if (g.status === "DRAWING") {
    return { phase: "DRAWING", target: null, captionKey: "gwPhase.caption.ended", statusKey: "gwPhase.drawing", extended }
  }
  if (g.status === "PAUSED") {
    return { phase: "PAUSED", target: null, captionKey: "gwPhase.caption.ended", statusKey: "gwPhase.paused", extended }
  }

  // Entries closed but not yet drawn (LOCKED, or time has passed the window).
  const entriesClosed = g.status === "LOCKED" || t >= end.getTime()
  if (entriesClosed) {
    return g.autoDraw
      ? { phase: "ENDED_AUTO", target: null, captionKey: "gwPhase.caption.ended", statusKey: "gwPhase.endedAuto", extended }
      : { phase: "ENDED_MANUAL", target: null, captionKey: "gwPhase.caption.ended", statusKey: "gwPhase.endedManual", extended }
  }

  // Before the entry window opens.
  if (t < start.getTime()) {
    return { phase: "BEFORE_START", target: start.toISOString(), captionKey: "gwPhase.caption.beforeStart", statusKey: "gwPhase.beforeStart", extended }
  }

  // Entries currently open.
  return { phase: "ACCEPTING", target: end.toISOString(), captionKey: "gwPhase.caption.accepting", statusKey: "gwPhase.accepting", extended }
}
