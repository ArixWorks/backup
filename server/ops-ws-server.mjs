// Standalone WebSocket server for the Operations Center realtime stream.
//
// Why standalone: Next.js route handlers cannot hold a long-lived WS server on
// serverless, and even on a VPS it is cleaner to run the WS gateway as its own
// process (restart/scale independently). This is the primary realtime tier;
// the app also ships an SSE fallback (/api/v1/admin/ops/stream) and SWR polling.
//
// Run on the VPS:
//   REDIS_URL=redis://... APP_URL=http://127.0.0.1:3000 \
//   OPS_WS_PORT=4001 node server/ops-ws-server.mjs
//
// Then point the dashboard at it with NEXT_PUBLIC_OPS_WS_URL=wss://host/ops-ws
// (proxy the path to OPS_WS_PORT via nginx, upgrading the connection).
//
// Auth: the browser sends its session cookie on the upgrade request; we forward
// it to APP_URL/api/v1/admin/ops/ws-auth which returns 200 only for admins.
// Fan-out: subscribes to the Redis "ops:events" channel and broadcasts to all
// authorized clients. Heartbeat ping/pong drops dead connections.

import { WebSocketServer } from "ws"
import Redis from "ioredis"
import http from "node:http"

const PORT = Number(process.env.OPS_WS_PORT ?? "4001")
const APP_URL = process.env.APP_URL ?? "http://127.0.0.1:3000"
const REDIS_URL = process.env.REDIS_URL
const CHANNEL = "ops:events"
const HEARTBEAT_MS = 30_000

if (!REDIS_URL) {
  console.log("[ops-ws] REDIS_URL is required for cross-instance fan-out. Exiting.")
  process.exit(1)
}

async function isAdmin(cookieHeader) {
  try {
    const res = await fetch(`${APP_URL}/api/v1/admin/ops/ws-auth`, {
      headers: { cookie: cookieHeader ?? "" },
    })
    return res.status === 200
  } catch (err) {
    console.log("[ops-ws] auth check failed:", err?.message)
    return false
  }
}

const server = http.createServer((req, res) => {
  // Simple health endpoint for the reverse proxy / uptime checks.
  if (req.url === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" })
    res.end(JSON.stringify({ ok: true, clients: wss.clients.size }))
    return
  }
  res.writeHead(426)
  res.end("Upgrade Required")
})

const wss = new WebSocketServer({ noServer: true })

// Authenticate during the HTTP upgrade so unauthorized clients never connect.
server.on("upgrade", async (req, socket, head) => {
  const ok = await isAdmin(req.headers.cookie)
  if (!ok) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n")
    socket.destroy()
    return
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req))
})

wss.on("connection", (ws) => {
  ws.isAlive = true
  ws.on("pong", () => {
    ws.isAlive = true
  })
  ws.send(JSON.stringify({ kind: "ready", at: new Date().toISOString(), payload: { ok: true } }))
})

// Drop dead connections; keep NAT/proxies warm.
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate()
      continue
    }
    ws.isAlive = false
    try {
      ws.ping()
    } catch {
      // ignore
    }
  }
  // Report liveness + connection count so the dashboard health grid can show
  // the WS server status (mirrors the app's heartbeat convention).
  reportHeartbeat(wss.clients.size)
}, HEARTBEAT_MS)

// --- Redis fan-out ----------------------------------------------------------

const sub = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 })
const pubForHeartbeat = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 })

sub.subscribe(CHANNEL, (err) => {
  if (err) console.log("[ops-ws] subscribe error:", err.message)
  else console.log(`[ops-ws] subscribed to ${CHANNEL}`)
})

sub.on("message", (_channel, message) => {
  for (const ws of wss.clients) {
    if (ws.readyState === ws.OPEN) {
      try {
        ws.send(message)
      } catch {
        // ignore individual send failures
      }
    }
  }
})

// Write the same heartbeat key the app's health probe reads (ops:heartbeat:ws).
function reportHeartbeat(connections) {
  const payload = JSON.stringify({ at: Date.now(), meta: { connections } })
  pubForHeartbeat.set("ops:heartbeat:ws", payload, "EX", 6 * 60 * 60).catch(() => {})
}

wss.on("close", () => clearInterval(heartbeat))

server.listen(PORT, () => {
  console.log(`[ops-ws] WebSocket server listening on :${PORT} (app: ${APP_URL})`)
  reportHeartbeat(0)
})

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log(`[ops-ws] ${sig} received, shutting down`)
    clearInterval(heartbeat)
    for (const ws of wss.clients) ws.close()
    server.close(() => process.exit(0))
  })
}
