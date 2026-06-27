import "server-only"
import { type CapturedError, type ErrorTracker, describeError } from "./types"

/**
 * Sentry-backed tracker. Works with BOTH Sentry Cloud (SaaS) and a Self-Hosted
 * Sentry instance — the only difference is the DSN, so no application code
 * changes are required to switch. Activated only when `SENTRY_DSN` (or
 * `NEXT_PUBLIC_SENTRY_DSN`) is present; otherwise this module is never loaded.
 *
 * The `@sentry/nextjs` import is dynamic so that builds/deploys without Sentry
 * configured never pay the cost and never fail.
 */

let initialized = false
// Loaded lazily to avoid bundling Sentry when it is not configured.
type SentryModule = typeof import("@sentry/nextjs")
let sentryPromise: Promise<SentryModule | null> | null = null

export function sentryDsn(): string | undefined {
  return process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN ?? undefined
}

export function isSentryEnabled(): boolean {
  return Boolean(sentryDsn())
}

async function loadSentry(): Promise<SentryModule | null> {
  if (!isSentryEnabled()) return null
  if (!sentryPromise) {
    sentryPromise = import("@sentry/nextjs")
      .then((mod) => {
        if (!initialized) {
          mod.init({
            dsn: sentryDsn(),
            // Self-hosted vs cloud is purely DSN-driven.
            environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
            release: process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA,
            // Performance/distributed tracing is enabled by a non-zero sample rate.
            tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
          })
          initialized = true
        }
        return mod
      })
      .catch(() => null)
  }
  return sentryPromise
}

export const sentryTracker: ErrorTracker = {
  name: "sentry",
  async capture(input: CapturedError): Promise<void> {
    try {
      const Sentry = await loadSentry()
      if (!Sentry) return
      const { name, message } = describeError(input.error)

      Sentry.withScope((scope) => {
        scope.setLevel((input.level ?? "error") as never)
        scope.setTag("source", input.source)
        if (input.userId) scope.setUser({ id: input.userId })
        if (input.release) scope.setTag("release", input.release)
        if (input.context) scope.setContext("context", input.context)
        if (input.fingerprint) scope.setFingerprint([input.fingerprint])
        for (const b of input.breadcrumbs ?? []) {
          scope.addBreadcrumb({ category: b.category, message: b.message, data: b.data })
        }

        if (input.error instanceof Error) {
          Sentry.captureException(input.error)
        } else {
          Sentry.captureMessage(input.message ?? `${name}: ${message}`)
        }
      })
    } catch {
      // Never let error capture throw.
    }
  },
  async flush(timeoutMs = 2000): Promise<void> {
    try {
      const Sentry = await loadSentry()
      await Sentry?.flush(timeoutMs)
    } catch {
      // ignore
    }
  },
}
