import "server-only"
import { prisma } from "@/lib/db"
import { cache } from "@/lib/redis"
import type { AlertComparator, AlertSeverity } from "@prisma/client"
import { dispatchAlert, type AlertChannel } from "./dispatch"
import { metricDef, METRICS } from "./registry"
import type { HealthResult } from "./health"

/**
 * Alert engine. Evaluates threshold rules against the latest metric values and
 * service-health probes, manages the FIRING → RESOLVED lifecycle of
 * `AlertEvent`s, and dispatches notifications with per-rule cooldown.
 */

const BREACH_PREFIX = "ops:breach:" // sustained-breach start timestamps
const COOLDOWN_PREFIX = "ops:alertcd:" // dispatch cooldown markers

function breaches(comparator: AlertComparator, value: number, threshold: number): boolean {
  return comparator === "GT" ? value >= threshold : value <= threshold
}

function parseChannels(raw: unknown): AlertChannel[] {
  if (Array.isArray(raw)) {
    return raw.filter((c): c is AlertChannel => c === "telegram" || c === "email" || c === "dashboard")
  }
  return ["dashboard"]
}

async function inCooldown(ruleId: string, cooldownSeconds: number): Promise<boolean> {
  if (cooldownSeconds <= 0) return false
  // setIfAbsent returns true when WE set it (i.e. not in cooldown yet).
  const fresh = await cache.setIfAbsent(COOLDOWN_PREFIX + ruleId, String(Date.now()), cooldownSeconds)
  return !fresh
}

/** Evaluate all enabled threshold rules against the provided latest values. */
export async function evaluateMetricAlerts(latest: Record<string, number | null>): Promise<{
  fired: number
  resolved: number
}> {
  const rules = await prisma.alertRule.findMany({ where: { enabled: true } })
  let fired = 0
  let resolved = 0

  for (const rule of rules) {
    const value = latest[rule.metric]
    if (value == null || !Number.isFinite(value)) continue

    const isBreaching = breaches(rule.comparator, value, rule.threshold)
    const breachKey = BREACH_PREFIX + rule.id
    const existing = await prisma.alertEvent.findFirst({
      where: { ruleId: rule.id, status: "FIRING" },
      orderBy: { startedAt: "desc" },
    })

    if (isBreaching) {
      // Track sustained-breach start for `forSeconds`.
      let breachStart = Number((await cache.get(breachKey)) ?? "0")
      if (!breachStart) {
        breachStart = Date.now()
        await cache.set(breachKey, String(breachStart), 24 * 3600)
      }
      const sustainedMs = Date.now() - breachStart
      if (sustainedMs < rule.forSeconds * 1000) continue // not sustained long enough

      if (!existing) {
        const def = metricDef(rule.metric)
        const event = await prisma.alertEvent.create({
          data: {
            ruleId: rule.id,
            title: rule.name,
            severity: rule.severity,
            status: "FIRING",
            metric: rule.metric,
            value,
            message: `${def?.label ?? rule.metric} = ${formatVal(value)} (آستانه: ${rule.comparator === "GT" ? "≥" : "≤"} ${formatVal(rule.threshold)})`,
          },
        })
        fired += 1
        if (!(await inCooldown(rule.id, rule.cooldownSeconds))) {
          await dispatchAlert({
            title: rule.name,
            message: event.message,
            severity: rule.severity as AlertSeverity,
            status: "FIRING",
            metric: rule.metric,
            value,
            channels: parseChannels(rule.channels),
            eventId: event.id,
          })
        }
      }
    } else {
      // Recovered: clear breach tracking and resolve any open event.
      await cache.del(breachKey)
      await cache.del(COOLDOWN_PREFIX + rule.id)
      if (existing) {
        await prisma.alertEvent.update({
          where: { id: existing.id },
          data: { status: "RESOLVED", resolvedAt: new Date(), value },
        })
        resolved += 1
        await dispatchAlert({
          title: rule.name,
          message: `وضعیت به حالت عادی بازگشت (${metricDef(rule.metric)?.label ?? rule.metric} = ${formatVal(value)})`,
          severity: rule.severity as AlertSeverity,
          status: "RESOLVED",
          metric: rule.metric,
          value,
          channels: parseChannels(rule.channels),
          eventId: existing.id,
        })
      }
    }
  }

  return { fired, resolved }
}

/**
 * Open/resolve alerts from service-health probes. Critical services that go
 * DOWN/DEGRADED open a CRITICAL/WARNING alert; recovery resolves it.
 */
export async function evaluateHealthAlerts(results: HealthResult[]): Promise<{ fired: number; resolved: number }> {
  let fired = 0
  let resolved = 0

  for (const r of results) {
    if (!r.critical) continue
    const metricKey = `service.${r.service}.health`
    const unhealthy = r.status === "DOWN" || r.status === "DEGRADED"
    const existing = await prisma.alertEvent.findFirst({
      where: { metric: metricKey, status: "FIRING" },
      orderBy: { startedAt: "desc" },
    })

    if (unhealthy) {
      if (!existing) {
        const severity: AlertSeverity = r.status === "DOWN" ? "CRITICAL" : "WARNING"
        const title = `سرویس ${r.label} ${r.status === "DOWN" ? "از دسترس خارج شد" : "دچار اختلال شد"}`
        const event = await prisma.alertEvent.create({
          data: {
            title,
            severity,
            status: "FIRING",
            metric: metricKey,
            message: r.message ?? `وضعیت سرویس: ${r.status}`,
            meta: { service: r.service, status: r.status },
          },
        })
        fired += 1
        const cdKey = `health:${r.service}`
        if (!(await inCooldown(cdKey, 900))) {
          await dispatchAlert({
            title,
            message: r.message ?? `وضعیت سرویس: ${r.status}`,
            severity,
            status: "FIRING",
            metric: metricKey,
            channels: ["telegram", "email", "dashboard"],
            eventId: event.id,
          })
        }
      }
    } else if (existing) {
      await prisma.alertEvent.update({
        where: { id: existing.id },
        data: { status: "RESOLVED", resolvedAt: new Date() },
      })
      resolved += 1
      await cache.del(`${COOLDOWN_PREFIX}health:${r.service}`)
      await dispatchAlert({
        title: `سرویس ${r.label} بازیابی شد`,
        message: `وضعیت سرویس به ${r.status} بازگشت`,
        severity: "INFO",
        status: "RESOLVED",
        metric: metricKey,
        channels: ["telegram", "email", "dashboard"],
        eventId: existing.id,
      })
    }
  }

  return { fired, resolved }
}

function formatVal(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(2)
}

/**
 * Idempotently create a sensible set of default alert rules derived from the
 * registry's `critical` thresholds. Safe to call repeatedly: each rule has a
 * deterministic name and is only created if no rule with that name exists.
 * Runs lazily on first collection so a fresh install has working alerts.
 */
export async function seedDefaultAlertRules(): Promise<number> {
  // Cheap guard so we don't query on every collection cycle.
  const marker = "ops:rules_seeded"
  if (!(await cache.setIfAbsent(marker, "1", 3600))) return 0

  const existing = await prisma.alertRule.findMany({ select: { name: true } })
  const have = new Set(existing.map((r) => r.name))

  const defaults = METRICS.filter((m) => m.critical != null).map((m) => ({
    name: `${m.label} بحرانی`,
    metric: m.name,
    comparator: (m.direction ?? "GT") as AlertComparator,
    threshold: m.critical as number,
    forSeconds: m.category === "infra" ? 120 : 60,
    severity: "CRITICAL" as AlertSeverity,
    channels: ["telegram", "email", "dashboard"],
    cooldownSeconds: 900,
  }))

  const toCreate = defaults.filter((d) => !have.has(d.name))
  if (toCreate.length === 0) return 0
  await prisma.alertRule.createMany({ data: toCreate })
  return toCreate.length
}
