import { requireAdmin } from "@/lib/auth/session"
import { cache } from "@/lib/redis"
import { Channels } from "@/lib/core/events"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Server-Sent Events stream for the Operations Center. Admin-only. Subscribes
 * to the ops pub/sub channel and forwards every event to the browser, plus a
 * periodic heartbeat so proxies/clients can detect a dead connection.
 *
 * This is the SSE tier of the hybrid transport (WS -> SSE -> SWR). It works on
 * any Node host today; the WS tier is used when a dedicated WS server is up.
 */
export async function GET(req: Request) {
  await requireAdmin()

  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | null = null
  let heartbeat: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(data))
        } catch {
          // controller may already be closed
        }
      }

      // Initial comment + retry hint (client reconnects after 3s if dropped).
      send(`retry: 3000\n\n`)
      send(`event: ready\ndata: {"ok":true}\n\n`)

      unsubscribe = await cache.subscribe(Channels.ops, (message) => {
        send(`data: ${message}\n\n`)
      })

      // Heartbeat comment every 20s (keeps the connection warm).
      heartbeat = setInterval(() => send(`: ping ${Date.now()}\n\n`), 20_000)

      // Tear down when the client disconnects.
      req.signal.addEventListener("abort", () => {
        if (heartbeat) clearInterval(heartbeat)
        unsubscribe?.()
        try {
          controller.close()
        } catch {
          // already closed
        }
      })
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat)
      unsubscribe?.()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx buffering for SSE
    },
  })
}
