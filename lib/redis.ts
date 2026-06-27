/**
 * Redis abstraction used for caching, distributed locks and realtime pub/sub.
 *
 * In production (self-hosted), set REDIS_URL and this module uses ioredis.
 * In the preview / local dev (no REDIS_URL), it transparently falls back to an
 * in-memory implementation so the app stays fully functional without Redis.
 *
 * The public surface is intentionally small so callers never depend on which
 * backend is active. Swapping to a managed Redis requires zero code changes.
 */
import type Redis from "ioredis"

type LockHandle = { key: string; token: string }

interface CacheBackend {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSeconds?: number): Promise<void>
  del(key: string): Promise<void>
  /**
   * Atomically increment a counter and (on first hit) set its TTL. Returns the
   * new counter value. Backs the fixed-window rate limiter.
   */
  incr(key: string, ttlSeconds: number): Promise<number>
  /**
   * Set only if absent (atomic). Returns true if this caller set the value.
   * Used for idempotency markers and webhook update de-duplication.
   */
  setIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean>
  acquireLock(key: string, ttlMs: number): Promise<LockHandle | null>
  releaseLock(handle: LockHandle): Promise<void>
  publish(channel: string, message: string): Promise<void>
  /**
   * Subscribe to a pub/sub channel. Returns an unsubscribe function. In memory
   * mode this is an in-process fan-out (works for a single instance, e.g. dev
   * or a single-node VPS). With Redis it spans all instances.
   */
  subscribe(channel: string, handler: (message: string) => void): Promise<() => void>
}

// --- In-memory backend (dev / preview) --------------------------------------

class MemoryBackend implements CacheBackend {
  private store = new Map<string, { value: string; expires: number | null }>()
  private locks = new Map<string, { token: string; expires: number }>()
  private channels = new Map<string, Set<(message: string) => void>>()

  async get(key: string) {
    const entry = this.store.get(key)
    if (!entry) return null
    if (entry.expires && entry.expires < Date.now()) {
      this.store.delete(key)
      return null
    }
    return entry.value
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    this.store.set(key, {
      value,
      expires: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    })
  }

  async del(key: string) {
    this.store.delete(key)
  }

  async incr(key: string, ttlSeconds: number) {
    const current = await this.get(key)
    const next = (current ? Number.parseInt(current, 10) || 0 : 0) + 1
    // Preserve the original window expiry: only set TTL on the first increment.
    const existing = this.store.get(key)
    const expires = current && existing?.expires ? existing.expires : Date.now() + ttlSeconds * 1000
    this.store.set(key, { value: String(next), expires })
    return next
  }

  async setIfAbsent(key: string, value: string, ttlSeconds: number) {
    const current = await this.get(key)
    if (current !== null) return false
    await this.set(key, value, ttlSeconds)
    return true
  }

  async acquireLock(key: string, ttlMs: number) {
    const now = Date.now()
    const existing = this.locks.get(key)
    if (existing && existing.expires > now) return null
    const token = Math.random().toString(36).slice(2)
    this.locks.set(key, { token, expires: now + ttlMs })
    return { key, token }
  }

  async releaseLock(handle: LockHandle) {
    const existing = this.locks.get(handle.key)
    if (existing && existing.token === handle.token) {
      this.locks.delete(handle.key)
    }
  }

  async publish(channel: string, message: string) {
    // In-process fan-out: delivers to subscribers in THIS instance. Spans
    // multiple instances only with Redis, but is fully functional for dev and
    // single-node deployments.
    const subs = this.channels.get(channel)
    if (!subs) return
    for (const handler of subs) {
      try {
        handler(message)
      } catch {
        // a bad subscriber must not break publish
      }
    }
  }

  async subscribe(channel: string, handler: (message: string) => void) {
    let set = this.channels.get(channel)
    if (!set) {
      set = new Set()
      this.channels.set(channel, set)
    }
    set.add(handler)
    return () => {
      set?.delete(handler)
      if (set && set.size === 0) this.channels.delete(channel)
    }
  }
}

// --- Redis backend (production) ----------------------------------------------

class RedisBackend implements CacheBackend {
  constructor(private client: Redis) {}

  async get(key: string) {
    return this.client.get(key)
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    if (ttlSeconds) await this.client.set(key, value, "EX", ttlSeconds)
    else await this.client.set(key, value)
  }

  async del(key: string) {
    await this.client.del(key)
  }

  async incr(key: string, ttlSeconds: number) {
    // INCR then set the window TTL only when the counter was just created.
    const lua =
      "local v = redis.call('incr', KEYS[1]); if v == 1 then redis.call('expire', KEYS[1], ARGV[1]) end; return v"
    const v = (await this.client.eval(lua, 1, key, String(ttlSeconds))) as number
    return v
  }

  async setIfAbsent(key: string, value: string, ttlSeconds: number) {
    const res = await this.client.set(key, value, "EX", ttlSeconds, "NX")
    return res === "OK"
  }

  async acquireLock(key: string, ttlMs: number) {
    const token = Math.random().toString(36).slice(2)
    const res = await this.client.set(key, token, "PX", ttlMs, "NX")
    return res === "OK" ? { key, token } : null
  }

  async releaseLock(handle: LockHandle) {
    // Release only if we still own the lock (atomic compare-and-delete).
    const lua =
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end"
    await this.client.eval(lua, 1, handle.key, handle.token)
  }

  async publish(channel: string, message: string) {
    await this.client.publish(channel, message)
  }

  async subscribe(channel: string, handler: (message: string) => void) {
    // A dedicated connection is required because a subscribed client cannot run
    // normal commands.
    const sub = this.client.duplicate()
    await sub.subscribe(channel)
    const listener = (ch: string, message: string) => {
      if (ch === channel) handler(message)
    }
    sub.on("message", listener)
    return () => {
      try {
        sub.off("message", listener)
        void sub.unsubscribe(channel).catch(() => {})
        void sub.quit().catch(() => {})
      } catch {
        // ignore teardown errors
      }
    }
  }
}

let backend: CacheBackend | null = null

function getBackend(): CacheBackend {
  if (backend) return backend
  const url = process.env.REDIS_URL
  if (url) {
    // Lazy require so ioredis is never loaded in environments without Redis.
    const IORedis = require("ioredis") as typeof import("ioredis").default
    backend = new RedisBackend(new IORedis(url, { maxRetriesPerRequest: 3 }))
  } else {
    backend = new MemoryBackend()
  }
  return backend
}

export const cache = {
  get: (key: string) => getBackend().get(key),
  set: (key: string, value: string, ttlSeconds?: number) =>
    getBackend().set(key, value, ttlSeconds),
  del: (key: string) => getBackend().del(key),
  incr: (key: string, ttlSeconds: number) => getBackend().incr(key, ttlSeconds),
  setIfAbsent: (key: string, value: string, ttlSeconds: number) =>
    getBackend().setIfAbsent(key, value, ttlSeconds),
  publish: (channel: string, message: string) =>
    getBackend().publish(channel, message),
  subscribe: (channel: string, handler: (message: string) => void) =>
    getBackend().subscribe(channel, handler),
}

/**
 * Run a function while holding a distributed lock. Used to serialize critical
 * sections (e.g. per-auction bid handling) across processes/instances.
 */
export async function withLock<T>(
  key: string,
  fn: () => Promise<T>,
  opts: { ttlMs?: number; retries?: number; retryDelayMs?: number } = {},
): Promise<T> {
  const { ttlMs = 5000, retries = 25, retryDelayMs = 100 } = opts
  const b = getBackend()
  let handle: LockHandle | null = null
  for (let i = 0; i < retries; i++) {
    handle = await b.acquireLock(key, ttlMs)
    if (handle) break
    await new Promise((r) => setTimeout(r, retryDelayMs))
  }
  if (!handle) {
    throw new DomainLockError("Could not acquire lock: " + key)
  }
  try {
    return await fn()
  } finally {
    await b.releaseLock(handle)
  }
}

export class DomainLockError extends Error {}
