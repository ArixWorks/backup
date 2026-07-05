import { syncAutomations, listAutomations, executeAutomation } from "../lib/ai/automations"

await syncAutomations()
const list = await listAutomations()
console.log(
  "[v0] registered:",
  list.map((a) => ({ key: a.key, enabled: a.enabled, every: a.intervalMin })),
)

// Execute the ticket triage (safe: read-only + admin notifications only).
const r = await executeAutomation("stale_ticket_triage")
console.log("[v0] triage run:", r.status, "-", r.summary)

const digest = await executeAutomation("daily_ops_digest")
console.log("[v0] digest run:", digest.status, "-", digest.summary)

process.exit(0)
