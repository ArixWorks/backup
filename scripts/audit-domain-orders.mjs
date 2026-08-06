// Ops audit: re-check every domain order and owned domain against the provider
// to surface any that were sold as a normal registration but are actually a
// premium/aftermarket listing or already taken.
//
// Usage: node --env-file-if-exists=/vercel/share/.env.project scripts/audit-domain-orders.mjs
//
// Exits non-zero when a mismatch is found, so it can be used as a check.
import { PrismaClient } from "@prisma/client"
import WebSocket from "ws"

const SOCKET_URL = "wss://backboard.railway.com/domain-search"
const REPLY_TIMEOUT_MS = 12_000

const prisma = new PrismaClient()

/** Ask the provider about every domain in one round trip. */
async function lookupAll(domains) {
  const seen = new Map()
  await new Promise((resolve) => {
    const socket = new WebSocket(SOCKET_URL, {
      handshakeTimeout: 10_000,
      headers: { Origin: "https://railway.com", "User-Agent": "Acciran-Domain-Availability/1.0" },
    })
    // Resolve exactly once and always tear the socket down. Without the close(),
    // the open handle keeps Node's event loop alive and the script hangs after
    // printing its report instead of exiting.
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.close()
      resolve()
    }
    const timer = setTimeout(finish, REPLY_TIMEOUT_MS)

    socket.on("open", () => socket.send(JSON.stringify({ type: "check", domains, query: domains.join(",") })))
    socket.on("message", (raw) => {
      let frame
      try {
        frame = JSON.parse(raw.toString())
      } catch {
        return
      }
      for (const [name, info] of Object.entries(frame?.domains ?? {})) seen.set(name, info)
      // Stop as soon as every requested name has an answer.
      if (domains.every((d) => seen.has(d))) finish()
    })
    socket.on("error", (err) => {
      console.error("[audit] socket error:", err.message)
      finish()
    })
    socket.on("close", finish)
  })
  return seen
}

/**
 * A domain is only a legitimate flat-price registration when the provider says
 * it is purchasable AND does not flag it as premium.
 */
function classify(info) {
  if (!info) return { label: "NO RESULT", ok: false }
  if (info.purchasable && info.premium) return { label: `PREMIUM $${info.purchasePrice}`, ok: false }
  if (info.purchasable) return { label: `available $${info.purchasePrice}`, ok: true }
  return { label: "TAKEN", ok: false }
}

/** Orders in these states never charged the customer, so a mismatch is harmless. */
const SETTLED_STATES = new Set(["EXPIRED", "CANCELLED", "REFUNDED", "FAILED"])

const orders = await prisma.domainOrder.findMany({
  select: { publicId: true, asciiDomain: true, status: true, amountIrt: true, createdAt: true },
  orderBy: { createdAt: "desc" },
})
const owned = await prisma.ownedDomain.findMany({ select: { asciiDomain: true, status: true } })

const domains = [...new Set([...orders.map((o) => o.asciiDomain), ...owned.map((o) => o.asciiDomain)])]
if (!domains.length) {
  console.log("[audit] no domains to check")
  await prisma.$disconnect()
  process.exit(0)
}

const seen = await lookupAll(domains)
const problems = []

console.log(`\n=== ORDERS (${orders.length}) ===`)
for (const order of orders) {
  const { label, ok } = classify(seen.get(order.asciiDomain))
  console.log(
    [
      order.publicId.padEnd(20),
      order.asciiDomain.padEnd(24),
      order.status.padEnd(18),
      String(order.amountIrt).padEnd(11),
      label,
    ].join(" "),
  )
  if (!ok && !SETTLED_STATES.has(order.status)) {
    problems.push(`order ${order.publicId} (${order.asciiDomain}, ${order.status}): ${label}`)
  }
}

console.log(`\n=== OWNED (${owned.length}) ===`)
for (const domain of owned) {
  const { label, ok } = classify(seen.get(domain.asciiDomain))
  console.log([domain.asciiDomain.padEnd(24), domain.status.padEnd(12), label].join(" "))
  // An owned domain reading TAKEN is expected: we registered it, so it is ours.
  if (!ok && label.startsWith("PREMIUM")) problems.push(`owned ${domain.asciiDomain}: ${label}`)
}

await prisma.$disconnect()

if (problems.length) {
  console.error(`\n[audit] ${problems.length} problem(s) found:`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}
console.log("\n[audit] no problems found")
