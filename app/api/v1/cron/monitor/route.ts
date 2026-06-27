import { route } from "@/lib/api/handler"
import { runCollection } from "@/lib/monitoring/collect"
import { withCron } from "@/lib/monitoring/instrument"
import { touchHeartbeat } from "@/lib/monitoring/heartbeat"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Monitoring collector. Runs one full collection cycle: real system/app/
 * business metrics, health probes, alert evaluation and realtime push.
 *
 * Schedule this frequently (e.g. every 15-60s) on the VPS:
 *   * * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" \
 *             https://<host>/api/v1/cron/monitor >/dev/null
 * On Vercel, add it to vercel.json crons (min 1/min).
 */
export const POST = route(async (req: Request) => {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      const { ForbiddenError } = await import("@/lib/core/errors")
      throw new ForbiddenError("Invalid cron secret")
    }
  }
  // Run the collection, then record a heartbeat whose meta carries the real
  // cron duration / failure count. The collector reads this meta to emit the
  // `app.cron.duration` and `app.cron.failures` metrics, and the health probe
  // reads the freshness under the "cron" key.
  const startedAt = Date.now()
  let failed = 0
  try {
    return await withCron("monitor", () => runCollection())
  } catch (err) {
    failed = 1
    throw err
  } finally {
    void touchHeartbeat("cron", { durationMs: Date.now() - startedAt, failures: failed })
  }
})

export const GET = POST
