// Mints a valid subio_session token for the admin account so an out-of-band
// browser (which has no project env) can be authenticated for design QA.
// Replicates the app's HMAC token format inline (no server-only imports).
import { readFileSync, readdirSync } from "node:fs"
import crypto from "node:crypto"
import pg from "pg"

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
    if (map.QA_ADMIN_EMAIL && map.AUTH_SECRET && (map.POSTGRES_URL_NON_POOLING || map.DATABASE_URL_UNPOOLED || map.DATABASE_URL)) {
      Object.assign(process.env, map)
      return true
    }
  }
  return false
}

if (!loadEnvFromProc()) {
  console.error("could not locate dev-server env")
  process.exit(1)
}

const b64url = (s) => Buffer.from(s).toString("base64url")
const sign = (data) => crypto.createHmac("sha256", process.env.AUTH_SECRET).update(data).digest("base64url")
function signSession(uid, ver = 0, ttl = 60 * 60 * 24 * 30) {
  const body = b64url(JSON.stringify({ uid, ver, exp: Math.floor(Date.now() / 1000) + ttl }))
  return `${body}.${sign(body)}`
}

const conn =
  process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } })
await client.connect()
const email = process.env.QA_ADMIN_EMAIL.toLowerCase().trim()
const { rows } = await client.query('SELECT id, "tokenVersion", role FROM "User" WHERE email = $1 LIMIT 1', [email])
await client.end()
if (!rows.length) {
  console.error("admin user not found:", email)
  process.exit(1)
}
const u = rows[0]
console.log("ROLE=" + u.role)
console.log("COOKIE_VALUE=" + signSession(u.id, u.tokenVersion ?? 0))
