// Verify email+password login end-to-end against the local dev server.
// Prints only status + whether a session cookie was issued (never the token).
// Usage: node scripts/verify-login.mjs <serverPid>  (loads env from /proc/<pid>/environ)
import { readFileSync, readdirSync } from "node:fs"

// Scan every /proc/<pid>/environ for the live process that holds the QA creds
// (the dev server). Done inside one process to avoid PID races with HMR.
function loadEnvFromProc() {
  for (const pid of readdirSync("/proc")) {
    if (!/^\d+$/.test(pid)) continue
    let raw
    try {
      raw = readFileSync(`/proc/${pid}/environ`)
    } catch {
      continue
    }
    const map = {}
    for (const entry of raw.toString("utf8").split("\0")) {
      const i = entry.indexOf("=")
      if (i > 0) map[entry.slice(0, i)] = entry.slice(i + 1)
    }
    if (map.QA_ADMIN_EMAIL && map.QA_ADMIN_PASSWORD && (map.POSTGRES_PRISMA_URL || map.DATABASE_URL)) {
      Object.assign(process.env, map)
      return pid
    }
  }
  return null
}
const foundPid = loadEnvFromProc()
console.log("env source pid:", foundPid || "(none)")

const base = "http://localhost:3000"
const email = process.env.QA_ADMIN_EMAIL
const password = process.env.QA_ADMIN_PASSWORD
if (!email || !password) {
  console.error("Missing QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD")
  process.exit(1)
}
const res = await fetch(`${base}/api/v1/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({ email, password }),
})
const setCookie = res.headers.get("set-cookie") || ""
const cookieName = setCookie.split("=")[0] || "(none)"
const json = await res.json().catch(() => ({}))
console.log("status:", res.status)
console.log("ok:", json.ok)
console.log("session cookie issued:", setCookie.includes("=") ? `yes (${cookieName})` : "no")
if (!json.ok) console.log("error:", JSON.stringify(json.error))
