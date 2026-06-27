import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()

function section(t) { console.log("\n=== " + t + " ===") }

// 1) Metric samples by category prefix
section("METRIC SAMPLES (distinct names + latest value)")
const names = await prisma.metricSample.findMany({
  distinct: ["name"],
  orderBy: { capturedAt: "desc" },
  select: { name: true, value: true, capturedAt: true },
})
const byPrefix = {}
for (const n of names) {
  const p = n.name.split(".")[0]
  byPrefix[p] = (byPrefix[p] || 0) + 1
}
console.log("prefixes:", JSON.stringify(byPrefix))
for (const n of names.sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(`  ${n.name} = ${n.value}`)
}

// 2) Series depth check (how many points for a couple metrics)
section("SERIES DEPTH (points in last 1h)")
const since = new Date(Date.now() - 3600_000)
for (const m of ["system.cpu.usage", "system.mem.usage", "app.rps", "biz.revenue_window"]) {
  const c = await prisma.metricSample.count({ where: { name: m, capturedAt: { gte: since } } })
  console.log(`  ${m}: ${c} points`)
}

// 3) Health snapshots
section("SERVICE HEALTH SNAPSHOTS")
const health = await prisma.serviceHealth.findMany({ orderBy: { service: "asc" } })
for (const h of health) {
  console.log(`  ${h.service.padEnd(14)} ${h.status.padEnd(8)} ${h.latencyMs ?? "-"}ms  @${h.checkedAt.toISOString()}`)
}

// 4) Alert rules
section("ALERT RULES")
const rules = await prisma.alertRule.findMany({ orderBy: { metric: "asc" } })
console.log(`  total: ${rules.length}, enabled: ${rules.filter(r => r.enabled).length}`)

// 5) Alert events
section("ALERT EVENTS (recent)")
const events = await prisma.alertEvent.findMany({ orderBy: { startedAt: "desc" }, take: 10 })
console.log(`  total recent: ${events.length}`)
for (const e of events) {
  console.log(`  [${e.status}] ${e.metric ?? e.service ?? "?"} val=${e.value ?? "-"} sev=${e.severity} @${e.startedAt.toISOString()}`)
}

// 6) Error groups
section("ERROR GROUPS")
const errs = await prisma.errorEvent?.findMany?.({ orderBy: { lastSeenAt: "desc" }, take: 5 }).catch(() => null)
if (errs) {
  console.log(`  total: ${errs.length}`)
  for (const e of errs) console.log(`  [${e.source}] ${e.message?.slice(0,60)} x${e.count} ${e.resolved ? "(resolved)" : ""}`)
} else {
  console.log("  (errorEvent model name differs — checking)")
}

await prisma.$disconnect()
