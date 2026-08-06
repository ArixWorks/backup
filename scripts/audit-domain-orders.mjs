// Temporary audit: re-check every domain order against the provider so we can
// see which ones were sold as normal registrations but are actually premium or
// already taken.
import { PrismaClient } from "@prisma/client"
import WebSocket from "ws"

const prisma = new PrismaClient()

const orders = await prisma.domainOrder.findMany({
  select: { publicId: true, asciiDomain: true, status: true, amountIrt: true, createdAt: true },
  orderBy: { createdAt: "desc" },
  take: 50,
})
console.log("[v0] domain orders:", orders.length)

const owned = await prisma.ownedDomain.findMany({ select: { asciiDomain: true, status: true } })
console.log("[v0] owned domains:", owned.length)

const domains = [...new Set([...orders.map((o) => o.asciiDomain), ...owned.map((o) => o.asciiDomain)])]
if (!domains.length) { console.log("[v0] nothing to check"); await prisma.$disconnect(); process.exit(0) }

const seen = new Map()
await new Promise((resolve) => {
  const socket = new WebSocket("wss://backboard.railway.com/domain-search", {
    handshakeTimeout: 10_000,
    headers: { Origin: "https://railway.com", "User-Agent": "Acciran-Domain-Availability/1.0" },
  })
  socket.on("open", () => socket.send(JSON.stringify({ type: "check", domains, query: domains.join(",") })))
  socket.on("message", (d) => {
    for (const [k, v] of Object.entries(JSON.parse(d.toString()).domains ?? {})) seen.set(k, v)
  })
  socket.on("error", (e) => { console.log("[v0] socket error:", e.message); resolve() })
  setTimeout(resolve, 9_000)
})

const verdict = (v) => {
  if (!v) return "NO RESULT"
  if (v.purchasable && v.premium) return `PREMIUM $${v.purchasePrice}`
  if (v.purchasable) return `free $${v.purchasePrice}`
  return "TAKEN"
}

console.log("\n=== ORDERS ===")
for (const o of orders) {
  console.log([o.publicId, o.asciiDomain.padEnd(22), o.status.padEnd(17),
    String(o.amountIrt).padEnd(10), verdict(seen.get(o.asciiDomain))].join(" "))
}
console.log("\n=== OWNED ===")
for (const o of owned) console.log(o.asciiDomain.padEnd(22), o.status.padEnd(10), verdict(seen.get(o.asciiDomain)))

await prisma.$disconnect()
