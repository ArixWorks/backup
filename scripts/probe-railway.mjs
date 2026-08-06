// Temporary diagnostic: re-check every domain we have an order for.
import WebSocket from "ws"

const domains = [
  "hostiva.com", "subiodf.shop", "sazario.org", "aasdasga.com",
  "arixdomaintest1785817708.com", "arixnovadomain1785816271.com", "khanegix.com",
  "virahesab.org", "accovira.net", "partino.org", "qatestdomain123.com",
  "simora.com", "techivo.com",
]
const socket = new WebSocket("wss://backboard.railway.com/domain-search", {
  handshakeTimeout: 10_000,
  headers: { Origin: "https://railway.com", "User-Agent": "Acciran-Domain-Availability/1.0" },
})
const seen = new Map()
socket.on("open", () => socket.send(JSON.stringify({ type: "check", domains, query: domains.join(",") })))
socket.on("message", (d) => {
  for (const [k, v] of Object.entries(JSON.parse(d.toString()).domains ?? {})) seen.set(k, v)
})
socket.on("error", (e) => console.log("[v0] error:", e.message))
setTimeout(() => {
  for (const dom of domains) {
    const v = seen.get(dom)
    const verdict = !v ? "NO RESULT"
      : v.purchasable && v.premium ? `*** PREMIUM $${v.purchasePrice} ***`
      : v.purchasable ? `free $${v.purchasePrice}` : "TAKEN"
    console.log(dom.padEnd(32), verdict)
  }
  process.exit(0)
}, 9_000)
