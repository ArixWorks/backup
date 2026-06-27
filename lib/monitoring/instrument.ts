import "server-only"
import type { ErrorSource } from "@prisma/client"
import { captureError } from "@/lib/monitoring/errors"
import { recordMetric } from "@/lib/monitoring/metrics"
import { reportServiceHealth } from "@/lib/monitoring/health"

/**
 * Wrap a background unit of work (cron job, queue worker, webhook handler) so
 * its duration, success/failure and errors are recorded for the Operations
 * Center. Re-throws after capturing so callers keep their own control flow.
 *
 * Metrics emitted:
 *   - `<source>.<name>.duration_ms`
 *   - `<source>.<name>.failed` (1 on failure)
 * and the service health row `<source>:<name>` is updated UP/DOWN.
 */
export async function instrument<T>(
  source: ErrorSource,
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now()
  const prefix = `${source.toLowerCase()}.${name}`
  try {
    const result = await fn()
    const ms = Date.now() - startedAt
    void recordMetric(`${prefix}.duration_ms`, ms)
    return result
  } catch (err) {
    const ms = Date.now() - startedAt
    void recordMetric(`${prefix}.duration_ms`, ms)
    void recordMetric(`${prefix}.failed`, 1)
    void captureError({ error: err, source, context: { unit: name, ms } })
    void reportServiceHealth({
      service: `${source.toLowerCase()}:${name}`,
      status: "DOWN",
      message: err instanceof Error ? err.message : String(err),
    }).catch(() => {})
    throw err
  }
}

/** Convenience wrappers for the common background sources. */
export const withCron = <T>(name: string, fn: () => Promise<T>) => instrument("CRON", name, fn)
export const withWorker = <T>(name: string, fn: () => Promise<T>) => instrument("WORKER", name, fn)
export const withQueue = <T>(name: string, fn: () => Promise<T>) => instrument("QUEUE", name, fn)
export const withWebhook = <T>(name: string, fn: () => Promise<T>) => instrument("WEBHOOK", name, fn)
