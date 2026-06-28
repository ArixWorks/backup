/**
 * End-to-end smoke test for the email subsystem, run against the real DB.
 *
 * Safe by design:
 *  - Uses Resend's official test inbox addresses (delivered@/bounced@resend.dev)
 *    which never affect sender reputation.
 *  - If RESEND_API_KEY is unset, the transport logs instead of sending, so the
 *    queue lifecycle is still exercised without touching the provider.
 *  - Cleans up every EmailJob/EmailEvent it creates (tagged via a unique key).
 */
import "dotenv/config"
import { prisma } from "@/lib/db"
import { enqueueEmail } from "@/lib/email/queue"
import { processEmailQueue } from "@/lib/email/worker"
import { applyProviderEvent } from "@/lib/email/events"
import { getEmailStats, readEmailBounceRate } from "@/lib/email/analytics"
import { validateEmail } from "@/lib/email/validation"

const TAG = `e2e-${Date.now()}`
let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

async function main() {
  console.log(`\n[email-e2e] starting (${TAG})\n`)

  // 1) Validation guards
  console.log("1) validation")
  check("rejects example.com", !validateEmail("x@example.com").ok)
  check("rejects malformed", !validateEmail("not-an-email").ok)
  check("accepts resend.dev test inbox", validateEmail("delivered@resend.dev").ok)

  // 2) Enqueue + idempotency
  console.log("2) enqueue + idempotency")
  const idem = `${TAG}:welcome`
  const a = await enqueueEmail({
    template: "GENERIC",
    to: "delivered@resend.dev",
    locale: "fa",
    idempotencyKey: idem,
    payload: { subject: "E2E", heading: "سلام", body: "تست end-to-end" },
  })
  const b = await enqueueEmail({
    template: "GENERIC",
    to: "delivered@resend.dev",
    locale: "fa",
    idempotencyKey: idem,
    payload: { subject: "E2E", heading: "سلام", body: "دوباره" },
  })
  check("first enqueue queued", a.queued === true && !a.deduped)
  check("duplicate idempotencyKey deduped", b.deduped === true && b.jobId === a.jobId, JSON.stringify(b))

  const jobId = a.jobId!

  // 3) Worker processing
  console.log("3) worker processing")
  const res = await processEmailQueue()
  check("worker claimed >= 1", res.claimed >= 1, JSON.stringify(res))
  const job = await prisma.emailJob.findUnique({ where: { id: jobId } })
  check("job left QUEUED state", job?.status !== "QUEUED", job?.status)
  check("job has subject rendered", Boolean(job?.subject), job?.subject ?? "(none)")

  // 4) Provider webhook events → status transitions (matched via provider id)
  console.log("4) webhook events")
  const pid = job?.providerId ?? undefined
  const d = await applyProviderEvent({ type: "email.delivered", data: { email_id: pid } })
  const delivered = await prisma.emailJob.findUnique({ where: { id: jobId } })
  check("delivered event matched job", d.matched, JSON.stringify(d))
  check("delivered status applied", delivered?.status === "DELIVERED" || delivered?.deliveredAt != null, delivered?.status)

  await applyProviderEvent({ type: "email.opened", data: { email_id: pid } })
  const opened = await prisma.emailJob.findUnique({ where: { id: jobId } })
  check("open tracked", (opened?.openCount ?? 0) >= 1, String(opened?.openCount))

  const events = await prisma.emailEvent.count({ where: { jobId } })
  check("events persisted", events >= 2, String(events))

  // 5) Analytics
  console.log("5) analytics")
  const stats = await getEmailStats(1)
  check("stats total >= 1", stats.total >= 1, JSON.stringify(stats))
  const bounce = await readEmailBounceRate()
  check("bounce rate is a number", typeof bounce === "number" && bounce >= 0, String(bounce))

  // Cleanup
  console.log("6) cleanup")
  await prisma.emailEvent.deleteMany({ where: { jobId } })
  const del = await prisma.emailJob.deleteMany({ where: { idempotencyKey: idem } })
  check("cleaned up test job", del.count >= 1)

  console.log(`\n[email-e2e] done — ${pass} passed, ${fail} failed\n`)
  await prisma.$disconnect()
  process.exit(fail === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error("[email-e2e] fatal:", e)
  await prisma.$disconnect()
  process.exit(1)
})
