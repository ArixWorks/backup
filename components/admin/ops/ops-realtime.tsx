"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

/**
 * Hybrid realtime transport for the Operations Center.
 *
 * Negotiation order (graceful degradation):
 *   1. WebSocket  — primary, bidirectional, lowest latency (VPS WS server).
 *   2. SSE        — fallback when WS is unavailable/unreachable.
 *   3. Polling    — final fallback; components keep their SWR refreshInterval.
 *
 * Features: automatic reconnection with exponential backoff + jitter, liveness
 * via the server heartbeat, and a clean teardown on unmount.
 */

export type OpsEventKind =
  | "metrics"
  | "health"
  | "alert"
  | "alert_resolved"
  | "activity"
  | "error"
  | "heartbeat"
  | "ready"

export type OpsEvent = {
  kind: OpsEventKind
  at: string
  payload: Record<string, unknown>
}

export type OpsTransport = "ws" | "sse" | "polling" | "connecting"

type OpsRealtimeValue = {
  transport: OpsTransport
  connected: boolean
  /** Last event received per kind (handy for "latest metrics/health"). */
  last: Partial<Record<OpsEventKind, OpsEvent>>
  /** Rolling activity feed (most recent first), capped. */
  feed: OpsEvent[]
  /** Monotonic counter; bump it in deps to react to any new event. */
  revision: number
  /** Subscribe to raw events. Returns an unsubscribe fn. */
  subscribe: (fn: (e: OpsEvent) => void) => () => void
}

const OpsRealtimeContext = createContext<OpsRealtimeValue | null>(null)

const WS_URL = process.env.NEXT_PUBLIC_OPS_WS_URL
const SSE_URL = "/api/v1/admin/ops/stream"
const FEED_MAX = 60
const WS_MAX_ATTEMPTS = 4

export function OpsRealtimeProvider({ children }: { children: React.ReactNode }) {
  const [transport, setTransport] = useState<OpsTransport>("connecting")
  const [last, setLast] = useState<Partial<Record<OpsEventKind, OpsEvent>>>({})
  const [feed, setFeed] = useState<OpsEvent[]>([])
  const [revision, setRevision] = useState(0)

  const listeners = useRef(new Set<(e: OpsEvent) => void>())
  const wsRef = useRef<WebSocket | null>(null)
  const sseRef = useRef<EventSource | null>(null)
  const wsAttempts = useRef(0)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const disposed = useRef(false)

  const subscribe = useCallback((fn: (e: OpsEvent) => void) => {
    listeners.current.add(fn)
    return () => {
      listeners.current.delete(fn)
    }
  }, [])

  const dispatch = useCallback((evt: OpsEvent) => {
    if (evt.kind === "ready") return
    setLast((prev) => ({ ...prev, [evt.kind]: evt }))
    setRevision((r) => r + 1)
    // Only user-visible event kinds belong in the activity feed.
    if (evt.kind === "activity" || evt.kind === "alert" || evt.kind === "alert_resolved" || evt.kind === "error") {
      setFeed((prev) => [evt, ...prev].slice(0, FEED_MAX))
    }
    for (const fn of listeners.current) {
      try {
        fn(evt)
      } catch {
        // a bad listener must not break dispatch
      }
    }
  }, [])

  const handleMessage = useCallback(
    (raw: string) => {
      try {
        const evt = JSON.parse(raw) as OpsEvent
        if (evt && typeof evt.kind === "string") dispatch(evt)
      } catch {
        // ignore malformed frames
      }
    },
    [dispatch],
  )

  // --- SSE fallback ---------------------------------------------------------
  const connectSse = useCallback(() => {
    if (disposed.current) return
    try {
      const es = new EventSource(SSE_URL)
      sseRef.current = es
      es.onopen = () => {
        if (!disposed.current) setTransport("sse")
      }
      es.onmessage = (e) => handleMessage(e.data)
      es.onerror = () => {
        // EventSource auto-reconnects; if it's permanently closed, degrade to
        // polling so components keep refreshing via SWR.
        if (es.readyState === EventSource.CLOSED && !disposed.current) {
          setTransport("polling")
        }
      }
    } catch {
      if (!disposed.current) setTransport("polling")
    }
  }, [handleMessage])

  // --- WebSocket primary ----------------------------------------------------
  const connectWs = useCallback(() => {
    if (disposed.current || !WS_URL) {
      connectSse()
      return
    }
    try {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        if (disposed.current) return
        wsAttempts.current = 0
        setTransport("ws")
      }
      ws.onmessage = (e) => handleMessage(typeof e.data === "string" ? e.data : "")
      ws.onclose = () => {
        if (disposed.current) return
        wsRef.current = null
        wsAttempts.current += 1
        if (wsAttempts.current >= WS_MAX_ATTEMPTS) {
          // Give up on WS for this session and fall back to SSE.
          connectSse()
          return
        }
        // Exponential backoff with jitter: 1s, 2s, 4s, 8s (+/- 0-400ms).
        const delay = Math.min(1000 * 2 ** (wsAttempts.current - 1), 8000) + Math.random() * 400
        reconnectTimer.current = setTimeout(connectWs, delay)
      }
      ws.onerror = () => {
        try {
          ws.close()
        } catch {
          // onclose handles reconnect
        }
      }
    } catch {
      connectSse()
    }
  }, [connectSse, handleMessage])

  useEffect(() => {
    disposed.current = false
    if (WS_URL) connectWs()
    else connectSse()

    return () => {
      disposed.current = true
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      try {
        wsRef.current?.close()
      } catch {
        // ignore
      }
      try {
        sseRef.current?.close()
      } catch {
        // ignore
      }
    }
  }, [connectWs, connectSse])

  const value = useMemo<OpsRealtimeValue>(
    () => ({
      transport,
      connected: transport === "ws" || transport === "sse",
      last,
      feed,
      revision,
      subscribe,
    }),
    [transport, last, feed, revision, subscribe],
  )

  return <OpsRealtimeContext.Provider value={value}>{children}</OpsRealtimeContext.Provider>
}

export function useOpsRealtime(): OpsRealtimeValue {
  const ctx = useContext(OpsRealtimeContext)
  if (!ctx) throw new Error("useOpsRealtime must be used within OpsRealtimeProvider")
  return ctx
}
