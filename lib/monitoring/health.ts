import "server-only"
import { prisma } from "@/lib/db"
import { cache } from "@/lib/redis"
import { botConfigured, getMe, getWebhookInfo } from "@/lib/telegram/api"
import { SERVICES, type ServiceDef } from "./registry"
import { readHeartbeat } from "./heartbeat"

/**
 * Health probes for every service in the registry. Each probe returns a real
 * status with measured latency. Nothing is faked: components we genuinely
 * cannot probe in the current runtime are reported as UNKNOWN with a reason.
 */

export type HealthStatus = "UP" | "DEGRADED" | "DOWN" | "UNKNOWN"

export interface HealthResult {
  service: string
  label: string
  kind: ServiceDef["kind"]
  critical: boolean
  status: HealthStatus
  latencyMs: number | null
  message: string | null
  meta: Record<string, unknown> | null
}

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value: T }> {
  const start = performance.now()
  const value = await fn()
  return { ms: Math.round((performance.now() - start) * 100) / 100, value }
}

// --- Individual probes -------------------------------------------------------

async function probePostgres(): Promise<Partial<HealthResult>> {
  try {
    const { ms } = await timed(() => prisma.$queryRaw`SELECT 1`)
    // Real connection + slow-query stats from pg_stat_activity.
    let connections: number | null = null
    let slow: number | null = null
    try {
      const rows = await prisma.$queryRaw<{ connections: bigint; slow: bigint }[]>`
        SELECT
          (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) AS connections,
          (SELECT count(*) FROM pg_stat_activity
             WHERE state = 'active' AND now() - query_start > interval '5 seconds') AS slow
      `
      if (rows[0]) {
        connections = Number(rows[0].connections)
        slow = Number(rows[0].slow)
      }
    } catch {
      // stats view may be restricted on some managed providers; latency still real.
    }
    const status: HealthStatus = ms > 400 ? "DEGRADED" : "UP"
    return { status, latencyMs: ms, message: null, meta: { connections, slowQueries: slow } }
  } catch (e) {
    return { status: "DOWN", latencyMs: null, message: (e as Error).message }
  }
}

async function probeRedis(): Promise<Partial<HealthResult>> {
  const hasRedis = Boolean(process.env.REDIS_URL)
  try {
    const key = "ops:health:redis:ping"
    const { ms } = await timed(async () => {
      await cache.set(key, String(Date.now()), 30)
      await cache.get(key)
    })
    if (!hasRedis) {
      return {
        status: "DEGRADED",
        latencyMs: ms,
        message: "حالت حافظه داخلی (REDIS_URL تنظیم نشده)",
        meta: { mode: "memory" },
      }
    }
    const status: HealthStatus = ms > 200 ? "DEGRADED" : "UP"
    return { status, latencyMs: ms, message: null, meta: { mode: "redis" } }
  } catch (e) {
    return { status: "DOWN", latencyMs: null, message: (e as Error).message }
  }
}

async function probeBot(): Promise<Partial<HealthResult>> {
  if (!botConfigured()) {
    return { status: "UNKNOWN", latencyMs: null, message: "توکن ربات تنظیم نشده" }
  }
  try {
    const { ms, value } = await timed(() => getMe())
    return {
      status: "UP",
      latencyMs: ms,
      message: null,
      meta: { username: (value as { username?: string })?.username ?? null },
    }
  } catch (e) {
    return { status: "DOWN", latencyMs: null, message: (e as Error).message }
  }
}

async function probeWebhook(): Promise<Partial<HealthResult>> {
  if (!botConfigured()) {
    return { status: "UNKNOWN", latencyMs: null, message: "توکن ربات تنظیم نشده" }
  }
  try {
    const { ms, value } = await timed(() => getWebhookInfo())
    const info = value as {
      url?: string
      pending_update_count?: number
      last_error_message?: string
      last_error_date?: number
    }
    if (!info.url) {
      return { status: "DEGRADED", latencyMs: ms, message: "Webhook تنظیم نشده", meta: { ...info } }
    }
    // A recent delivery error (within ~10 min) means degraded delivery.
    const recentError =
      info.last_error_date && Date.now() / 1000 - info.last_error_date < 600
    const status: HealthStatus = recentError ? "DEGRADED" : "UP"
    return {
      status,
      latencyMs: ms,
      message: recentError ? info.last_error_message ?? "خطای اخیر در تحویل" : null,
      meta: { pending: info.pending_update_count ?? 0, url: info.url },
    }
  } catch (e) {
    return { status: "DOWN", latencyMs: null, message: (e as Error).message }
  }
}

async function probeEmail(): Promise<Partial<HealthResult>> {
  const configured = Boolean(process.env.RESEND_API_KEY)
  // Inspect the durable queue: a large backlog or many recent failures means
  // delivery is degraded even if the provider key is present.
  let queued = 0
  let failed24h = 0
  let oldestQueuedMin: number | null = null
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const [q, f, oldest] = await Promise.all([
      prisma.emailJob.count({ where: { status: "QUEUED" } }),
      prisma.emailJob.count({ where: { status: "FAILED", failedAt: { gte: since } } }),
      prisma.emailJob.findFirst({ where: { status: "QUEUED" }, orderBy: { queuedAt: "asc" }, select: { queuedAt: true } }),
    ])
    queued = q
    failed24h = f
    if (oldest) oldestQueuedMin = Math.round((Date.now() - oldest.queuedAt.getTime()) / 60000)
  } catch {
    // table may not exist yet on a fresh DB; fall back to config-only status.
  }

  const meta = { provider: "resend", queued, failed24h, oldestQueuedMin }
  if (!configured) {
    return { status: "DEGRADED", latencyMs: null, message: "RESEND_API_KEY تنظیم نشده (فقط ثبت می‌شود)", meta }
  }
  // Backlog stuck for >15 min or a spike of failures => degraded.
  if ((oldestQueuedMin != null && oldestQueuedMin > 15) || queued > 500) {
    return { status: "DEGRADED", latencyMs: null, message: `صف ایمیل پر است (${queued} در انتظار)`, meta }
  }
  if (failed24h > 20) {
    return { status: "DEGRADED", latencyMs: null, message: `ارسال‌های ناموفق زیاد (${failed24h} در ۲۴ ساعت)`, meta }
  }
  return { status: "UP", latencyMs: null, message: null, meta }
}

async function probePing(def: ServiceDef): Promise<Partial<HealthResult>> {
  const url = def.ping ? process.env[def.ping.urlEnv] : undefined
  if (!url) {
    return { status: "UNKNOWN", latencyMs: null, message: "آدرس بررسی پیکربندی نشده" }
  }
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const { ms, value } = await timed(() =>
      fetch(url, { method: def.ping?.method ?? "GET", signal: controller.signal }),
    )
    clearTimeout(timer)
    const expect = def.ping?.expectStatus
    const ok = expect ? value.status === expect : value.ok
    const status: HealthStatus = ok ? (ms > 1000 ? "DEGRADED" : "UP") : "DOWN"
    return { status, latencyMs: ms, message: ok ? null : `HTTP ${value.status}`, meta: { httpStatus: value.status } }
  } catch (e) {
    return { status: "DOWN", latencyMs: null, message: (e as Error).message }
  }
}

/** Heartbeat-backed liveness for long-lived workers (cron/queue/worker/ws). */
async function probeHeartbeat(key: string, maxAgeMs: number): Promise<Partial<HealthResult>> {
  const hb = await readHeartbeat(key)
  if (!hb) {
    return { status: "UNKNOWN", latencyMs: null, message: "هنوز سیگنالی دریافت نشده" }
  }
  const status: HealthStatus = hb.ageMs <= maxAgeMs ? "UP" : hb.ageMs <= maxAgeMs * 3 ? "DEGRADED" : "DOWN"
  return {
    status,
    latencyMs: null,
    message: status === "UP" ? null : `آخرین سیگنال ${Math.round(hb.ageMs / 1000)} ثانیه پیش`,
    meta: hb.meta ?? undefined,
  }
}

// --- Orchestration -----------------------------------------------------------

async function probeService(def: ServiceDef): Promise<HealthResult> {
  const base: HealthResult = {
    service: def.key,
    label: def.label,
    kind: def.kind,
    critical: Boolean(def.critical),
    status: "UNKNOWN",
    latencyMs: null,
    message: null,
    meta: null,
  }
  let partial: Partial<HealthResult>
  switch (def.key) {
    case "postgres":
      partial = await probePostgres()
      break
    case "redis":
      partial = await probeRedis()
      break
    case "bot":
      partial = await probeBot()
      break
    case "webhook":
      partial = await probeWebhook()
      break
    case "email":
      partial = await probeEmail()
      break
    // Internal HTTP-served surfaces: if this code runs, the API/web layer is up.
    case "web":
    case "miniapp":
    case "admin":
    case "api":
      partial = { status: "UP", latencyMs: null, message: null }
      break
    case "cron":
      partial = await probeHeartbeat("cron", 5 * 60_000)
      break
    case "queue":
      partial = await probeHeartbeat("queue", 2 * 60_000)
      break
    case "worker":
      partial = await probeHeartbeat("worker", 2 * 60_000)
      break
    case "ws":
      partial = await probeHeartbeat("ws", 60_000)
      break
    default:
      partial = await probePing(def)
  }
  return { ...base, ...partial }
}

/**
 * Probe every registered service and persist the latest snapshot per service.
 * Returns the full list for immediate use by the API.
 */
export async function checkAll(): Promise<HealthResult[]> {
  const results = await Promise.all(SERVICES.map((def) => probeService(def)))

  // Persist latest snapshot per service (upsert keyed on `service`).
  await Promise.all(
    results.map((r) =>
      prisma.serviceHealth
        .upsert({
          where: { service: r.service },
          create: {
            service: r.service,
            status: r.status,
            latencyMs: r.latencyMs ?? undefined,
            message: r.message ?? undefined,
            meta: (r.meta ?? undefined) as object | undefined,
          },
          update: {
            status: r.status,
            latencyMs: r.latencyMs ?? null,
            message: r.message ?? null,
            meta: (r.meta ?? undefined) as object | undefined,
            checkedAt: new Date(),
          },
        })
        .catch(() => {}),
    ),
  )

  return results
}

/**
 * Upsert a single service's health snapshot. Used by background units
 * (cron/worker/queue) and the heartbeat endpoint to report their own status
 * outside the central probe cycle.
 */
export async function reportServiceHealth(input: {
  service: string
  status: HealthStatus
  latencyMs?: number | null
  message?: string | null
  meta?: Record<string, unknown> | null
}): Promise<void> {
  try {
    await prisma.serviceHealth.upsert({
      where: { service: input.service },
      create: {
        service: input.service,
        status: input.status,
        latencyMs: input.latencyMs ?? undefined,
        message: input.message ?? undefined,
        meta: (input.meta ?? undefined) as object | undefined,
      },
      update: {
        status: input.status,
        latencyMs: input.latencyMs ?? null,
        message: input.message ?? null,
        meta: (input.meta ?? undefined) as object | undefined,
        checkedAt: new Date(),
      },
    })
  } catch {
    // best-effort
  }
}

/** Read the last persisted health snapshot for all services (no live probing). */
export async function getLatestHealth(): Promise<HealthResult[]> {
  const rows = await prisma.serviceHealth.findMany()
  const byKey = new Map(rows.map((r) => [r.service, r]))
  return SERVICES.map((def) => {
    const row = byKey.get(def.key)
    return {
      service: def.key,
      label: def.label,
      kind: def.kind,
      critical: Boolean(def.critical),
      status: (row?.status as HealthStatus) ?? "UNKNOWN",
      latencyMs: row?.latencyMs ?? null,
      message: row?.message ?? null,
      meta: (row?.meta as Record<string, unknown> | null) ?? null,
    }
  })
}

/** Overall platform health derived from critical-service statuses. */
export function overallStatus(results: HealthResult[]): HealthStatus {
  const critical = results.filter((r) => r.critical)
  if (critical.some((r) => r.status === "DOWN")) return "DOWN"
  if (critical.some((r) => r.status === "DEGRADED")) return "DEGRADED"
  if (critical.length > 0 && critical.every((r) => r.status === "UP")) return "UP"
  return "UNKNOWN"
}
