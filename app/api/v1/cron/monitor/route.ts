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
  void touchHeartbeat("monitor")
  return withCron("monitor", () => runCollection())
})

export const GET = POST
