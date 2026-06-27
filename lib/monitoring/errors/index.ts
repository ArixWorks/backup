import "server-only"
import type { CapturedError, ErrorTracker } from "./types"
import { dbTracker } from "./db-tracker"
import { isSentryEnabled } from "./sentry-tracker"

export type { CapturedError } from "./types"
export { isSentryEnabled, sentryDsn } from "./sentry-tracker"

/**
 * Resolve the active set of error trackers. The DB tracker is ALWAYS on so the
 * Operations Center has data with zero configuration. Sentry (cloud OR
 * self-hosted) is added only when a DSN is configured — and its module is
 * imported lazily so unconfigured builds never bundle it.
 */
async function resolveTrackers(): Promise<ErrorTracker[]> {
  const trackers: ErrorTracker[] = [dbTracker]
  if (isSentryEnabled()) {
    const { sentryTracker } = await import("./sentry-tracker")
    trackers.push(sentryTracker)
  }
  return trackers
}

/**
 * Capture an error/exception from anywhere in the ecosystem (web, mini app,
 * bot, API, server actions, workers, cron, queue, webhooks). Fans out to every
 * active tracker and never throws.
 */
export async function captureError(input: CapturedError): Promise<void> {
  const trackers = await resolveTrackers()
  await Promise.allSettled(trackers.map((t) => t.capture(input)))
}

/** Flush buffered events (call at the end of serverless cron/webhook handlers). */
export async function flushErrors(timeoutMs?: number): Promise<void> {
  if (!isSentryEnabled()) return
  try {
    const { sentryTracker } = await import("./sentry-tracker")
    await sentryTracker.flush?.(timeoutMs)
  } catch {
    // ignore
  }
}
