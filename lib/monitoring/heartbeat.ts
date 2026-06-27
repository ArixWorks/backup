import "server-only"
import { cache } from "@/lib/redis"

/**
 * Lightweight liveness heartbeats for long-lived/!request-bound components
 * (cron, queue worker, WS server, background worker). Each component calls
 * `touchHeartbeat(key)` periodically; health probes read freshness via
 * `readHeartbeat(key)`. Backed by `cache` (Redis in prod, memory in preview).
 */

const PREFIX = "ops:heartbeat:"
const TTL_SECONDS = 6 * 60 * 60 // keep a heartbeat record up to 6h

export async function touchHeartbeat(key: string, meta?: Record<string, unknown>) {
  try {
    const payload = JSON.stringify({ at: Date.now(), meta: meta ?? null })
    await cache.set(PREFIX + key, payload, TTL_SECONDS)
  } catch {
    // best-effort
  }
}

export async function readHeartbeat(
  key: string,
): Promise<{ at: number; ageMs: number; meta: Record<string, unknown> | null } | null> {
  try {
    const raw = await cache.get(PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at: number; meta: Record<string, unknown> | null }
    return { at: parsed.at, ageMs: Date.now() - parsed.at, meta: parsed.meta }
  } catch {
    return null
  }
}
