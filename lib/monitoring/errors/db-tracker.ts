import "server-only"
import { prisma } from "@/lib/db"
import { emitOps } from "@/lib/core/events"
import { recordMetric } from "@/lib/monitoring/metrics"
import {
  type CapturedError,
  type ErrorTracker,
  buildFingerprint,
  describeError,
} from "./types"

/**
 * Always-on error tracker backed by the `ErrorEvent` table. Groups by
 * fingerprint (Sentry-style), counts occurrences, and pushes a realtime
 * event to the Operations Center stream. Fully self-contained — works with
 * zero external configuration.
 */
export const dbTracker: ErrorTracker = {
  name: "database",
  async capture(input: CapturedError): Promise<void> {
    try {
      const { name, message, stack } = describeError(input.error)
      const fingerprint =
        input.fingerprint ?? buildFingerprint(input.source, name, input.message ?? message)
      const level = input.level ?? "error"
      const finalMessage = (input.message ?? message).slice(0, 2000)

      // Record an error sample so the dashboard can chart the error trend and
      // alert rules can watch `app.errors`.
      void recordMetric("app.errors", 1, { source: input.source, level })

      const row = await prisma.errorEvent.upsert({
        where: { fingerprint },
        create: {
          level,
          source: input.source,
          name: name.slice(0, 200),
          message: finalMessage,
          stack: stack?.slice(0, 8000),
          fingerprint,
          context: (input.context ?? undefined) as object | undefined,
          userId: input.userId ?? undefined,
          release: input.release ?? undefined,
        },
        update: {
          count: { increment: 1 },
          lastSeenAt: new Date(),
          // A previously-resolved error reoccurring should re-open.
          resolved: false,
          resolvedAt: null,
          message: finalMessage,
          stack: stack?.slice(0, 8000),
          level,
        },
      })

      await emitOps({
        kind: "error",
        payload: {
          id: row.id,
          source: row.source,
          level: row.level,
          name: row.name,
          message: row.message,
          count: row.count,
          fingerprint: row.fingerprint,
        },
      })
    } catch {
      // Never let error capture throw.
    }
  },
}
