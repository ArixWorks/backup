/**
 * Disaster-recovery verification — runs ENTIRELY against an isolated Neon
 * branch. It NEVER reads the production datasource env and NEVER falls back to
 * `public` on main: it connects ONLY through the explicit `DR_BRANCH_URL`, and
 * refuses to run if that URL resolves to the same host as production.
 *
 * Orchestration (done by the operator via the Neon MCP, not this script):
 *   1. create a branch from main           (clone — has schema + structural data)
 *   2. seed demo data into the branch       (tsx prisma/seed.ts with env override)
 *   3. run THIS script with DR_BRANCH_URL    (backup → wipe → restore → verify)
 *   4. delete the branch
 *
 * The branch has its own physical endpoint, so the TRUNCATE here cannot reach
 * main even in the worst case. This is the safety property the previous
 * schema-based harness lacked.
 */
import { gzipSync, gunzipSync } from "node:zlib"
import { createHash } from "node:crypto"
import { Prisma, PrismaClient } from "@prisma/client"

const FORMAT_VERSION = 3

// ----------------------------- guards ---------------------------------------
const BRANCH_URL = process.env.DR_BRANCH_URL
if (!BRANCH_URL) {
  console.error("⛔ DR_BRANCH_URL is required. This test only runs against an isolated Neon branch.")
  process.exit(1)
}
function hostOf(u?: string): string {
  try {
    return u ? new URL(u).host : ""
  } catch {
    return ""
  }
}
const prodHosts = new Set(
  [process.env.POSTGRES_PRISMA_URL, process.env.POSTGRES_URL_NON_POOLING, process.env.DATABASE_URL]
    .map(hostOf)
    .filter(Boolean),
)
if (prodHosts.has(hostOf(BRANCH_URL))) {
  console.error("⛔ DR_BRANCH_URL points at the SAME host as production. Refusing to run.")
  console.error("   This test must target a separate Neon branch endpoint.")
  process.exit(1)
}

const prisma = new PrismaClient({ datasources: { db: { url: BRANCH_URL } } })

// ----------------------------- helpers ---------------------------------------
function replacer(_k: string, v: unknown) {
  return typeof v === "bigint" ? { __t: "bigint", v: v.toString() } : v
}
function reviver(_k: string, v: any) {
  return v && typeof v === "object" && v.__t === "bigint" ? BigInt(v.v) : v
}
const models = Prisma.dmmf.datamodel.models
const delegateName = (m: string) => m.charAt(0).toLowerCase() + m.slice(1)

/** Topological order from DMMF so inserts respect FK dependencies. */
function topoOrder(): string[] {
  const deps = new Map<string, Set<string>>()
  const names = new Set(models.map((m) => m.name))
  for (const m of models) {
    const set = new Set<string>()
    for (const f of m.fields) {
      if (f.kind === "object" && f.relationFromFields && f.relationFromFields.length && names.has(f.type) && f.type !== m.name) {
        set.add(f.type)
      }
    }
    deps.set(m.name, set)
  }
  const out: string[] = []
  const seen = new Set<string>()
  const visit = (n: string, stack: Set<string>) => {
    if (seen.has(n)) return
    if (stack.has(n)) return // cycle guard (none expected beyond self-ref)
    stack.add(n)
    for (const d of deps.get(n) ?? []) visit(d, stack)
    stack.delete(n)
    seen.add(n)
    out.push(n)
  }
  for (const m of models) visit(m.name, new Set())
  return out
}
const ORDER = topoOrder()

// ----------------------------- backup ----------------------------------------
async function backup() {
  const data: Record<string, unknown[]> = {}
  const tables: Record<string, number> = {}
  let total = 0
  for (const m of models) {
    const rows = await (prisma as any)[delegateName(m.name)].findMany()
    data[m.name] = rows
    tables[m.name] = rows.length
    total += rows.length
  }
  const checksum = createHash("sha256").update(JSON.stringify({ order: ORDER, tables, data }, replacer)).digest("hex")
  const payload = { format: FORMAT_VERSION, createdAt: new Date().toISOString(), checksum, order: ORDER, tables, data }
  const buf = gzipSync(Buffer.from(JSON.stringify(payload, replacer), "utf8"), { level: 9 })
  return { buf, total, checksum, tables }
}

// ----------------------------- snapshot (for deep compare) --------------------
/** Per-table count + a stable hash of all rows (sorted by id) for equality. */
async function snapshot() {
  const snap: Record<string, { count: number; hash: string }> = {}
  for (const m of models) {
    const rows: any[] = await (prisma as any)[delegateName(m.name)].findMany()
    rows.sort((a, b) => String(a.id ?? JSON.stringify(a)).localeCompare(String(b.id ?? JSON.stringify(b))))
    const hash = createHash("sha256").update(JSON.stringify(rows, replacer)).digest("hex")
    snap[m.name] = { count: rows.length, hash }
  }
  return snap
}

// ----------------------------- wipe (branch only) ----------------------------
async function wipe() {
  // Schema-qualified, reverse topo order, single statement, branch connection.
  const list = [...ORDER].reverse().map((n) => `"public"."${n}"`).join(", ")
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`)
}

// ----------------------------- restore ----------------------------------------
async function restore(buf: Buffer) {
  // Validate first (gunzip + parse + version + checksum).
  const raw = gunzipSync(buf).toString("utf8")
  const parsed = JSON.parse(raw, reviver) as {
    format?: number
    checksum?: string
    order?: string[]
    tables?: Record<string, number>
    data: Record<string, any[]>
  }
  if (parsed.format !== FORMAT_VERSION) throw new Error("format mismatch")
  // checksum is computed on the BigInt-encoded form, so recompute from a re-encode
  const recomputed = createHash("sha256")
    .update(JSON.stringify({ order: parsed.order, tables: parsed.tables, data: parsed.data }, replacer))
    .digest("hex")
  if (parsed.checksum && parsed.checksum !== recomputed) throw new Error("checksum mismatch")

  const order = parsed.order ?? ORDER
  const referrals: { id: unknown; referredById: unknown; updatedAt: unknown }[] = []
  for (const u of parsed.data["User"] ?? []) {
    if (u.referredById != null) referrals.push({ id: u.id, referredById: u.referredById, updatedAt: u.updatedAt })
  }

  await prisma.$transaction(
    async (tx) => {
      const list = [...order].reverse().map((n) => `"public"."${n}"`).join(", ")
      await tx.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE;`)
      for (const name of order) {
        const rows = parsed.data[name] ?? []
        if (!rows.length) continue
        const toInsert =
          name === "User" ? rows.map((r) => ({ ...r, referredById: null })) : rows
        await (tx as any)[delegateName(name)].createMany({ data: toInsert, skipDuplicates: true })
      }
      // Re-apply inviter self-refs, preserving original updatedAt.
      for (const link of referrals) {
        await tx.user
          .update({
            where: { id: link.id as string },
            data: {
              referredById: link.referredById as string,
              ...(link.updatedAt != null ? { updatedAt: link.updatedAt as Date } : {}),
            },
          })
          .catch(() => {})
      }
    },
    { timeout: 120_000, maxWait: 30_000 },
  )
}

// ----------------------------- verify ----------------------------------------
type Check = { name: string; pass: boolean; detail: string }

async function ledgerSum(): Promise<bigint> {
  const legs = await prisma.ledgerLeg.findMany({ select: { amount: true } })
  return legs.reduce((a, l) => a + l.amount, 0n)
}
async function walletTotals(): Promise<string> {
  const ws = await prisma.wallet.findMany({ select: { totalBalance: true } })
  return ws.reduce((a, w) => a + w.totalBalance, 0n).toString()
}

async function verify(before: Record<string, { count: number; hash: string }>, beforeLedger: bigint, beforeWallet: string) {
  const after = await snapshot()
  const checks: Check[] = []

  // 1. record counts per table
  let countMismatch = 0
  for (const m of models) {
    if (before[m.name].count !== after[m.name].count) {
      countMismatch++
      checks.push({ name: `count:${m.name}`, pass: false, detail: `${before[m.name].count} → ${after[m.name].count}` })
    }
  }
  checks.push({ name: "record counts (all 45 tables)", pass: countMismatch === 0, detail: countMismatch === 0 ? "all match" : `${countMismatch} mismatched` })

  // 2. per-table row hash equality (catches any field/value drift)
  let hashMismatch: string[] = []
  for (const m of models) {
    if (before[m.name].hash !== after[m.name].hash) hashMismatch.push(m.name)
  }
  checks.push({ name: "row-level data integrity (sha256)", pass: hashMismatch.length === 0, detail: hashMismatch.length === 0 ? "all tables identical" : `drift: ${hashMismatch.join(", ")}` })

  // 3. FK integrity — referral self-refs survived
  const refUsers = await prisma.user.count({ where: { referredById: { not: null } } })
  const orphanRefs = await prisma.$queryRawUnsafe<{ c: number }[]>(
    `SELECT count(*)::int c FROM "public"."User" u WHERE u."referredById" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public"."User" p WHERE p.id = u."referredById")`,
  )
  checks.push({ name: "FK integrity (referrals)", pass: orphanRefs[0].c === 0, detail: `${refUsers} referral links, ${orphanRefs[0].c} orphaned` })

  // 4. ledger zero-sum preserved
  const afterLedger = await ledgerSum()
  checks.push({ name: "ledger balance", pass: afterLedger === beforeLedger, detail: `before=${beforeLedger} after=${afterLedger}` })

  // 5. wallet totals preserved
  const afterWallet = await walletTotals()
  checks.push({ name: "wallet balances", pass: afterWallet === beforeWallet, detail: `before=${beforeWallet} after=${afterWallet}` })

  // 6. entity-type presence round-trip (products, orders, auctions, giveaways, notifications, audit, settings, coupons)
  for (const t of ["Product", "Order", "Auction", "Bid", "Giveaway", "Notification", "AuditLog", "Setting", "Coupon"]) {
    const b = before[t]?.count ?? 0
    const a = after[t]?.count ?? 0
    checks.push({ name: `entity:${t}`, pass: b === a, detail: `${b} → ${a}` })
  }

  // 7. functional test against restored data — read a product + its sale relation
  let functional = false
  let funcDetail = "no products to test"
  const prod = await prisma.product.findFirst({ include: { fixedSale: true, auction: true } })
  if (prod) {
    functional = !!(prod.fixedSale || prod.auction)
    funcDetail = `product "${prod.title}" loaded with ${prod.fixedSale ? "fixedSale" : ""}${prod.auction ? "auction" : ""} relation`
  }
  checks.push({ name: "functional read (product+relations)", pass: functional || !prod, detail: funcDetail })

  return checks
}

// ----------------------------- main ------------------------------------------
async function main() {
  console.log("=== DR VERIFY (isolated Neon branch) ===")
  console.log(`branch host: ${hostOf(BRANCH_URL)}\n`)

  console.log("• snapshotting branch (pre-backup) …")
  const before = await snapshot()
  const beforeLedger = await ledgerSum()
  const beforeWallet = await walletTotals()
  const beforeTotal = Object.values(before).reduce((a, s) => a + s.count, 0)
  console.log(`  ${beforeTotal} rows across ${models.length} tables`)

  console.log("• creating backup …")
  const { buf, total, checksum, tables } = await backup()
  console.log(`  ${total} rows, ${(buf.byteLength / 1024).toFixed(1)} KB, sha256 ${checksum.slice(0, 16)}…`)
  const topTables = Object.entries(tables).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 8)
  console.log(`  populated: ${topTables.map(([t, n]) => `${t}=${n}`).join(", ")}`)

  console.log("• simulating disaster (TRUNCATE on BRANCH) …")
  await wipe()
  const wiped = await prisma.user.count()
  console.log(`  branch users after wipe: ${wiped}`)

  console.log("• restoring from backup …")
  await restore(buf)

  console.log("• verifying …\n")
  const checks = await verify(before, beforeLedger, beforeWallet)

  let allPass = true
  for (const c of checks) {
    const icon = c.pass ? "PASS" : "FAIL"
    if (!c.pass) allPass = false
    console.log(`  [${icon}] ${c.name} — ${c.detail}`)
  }
  console.log("")
  console.log(allPass ? "RESULT: ✅ ALL CHECKS PASSED" : "RESULT: ❌ FAILURES DETECTED")
  if (!allPass) process.exitCode = 2
}

main()
  .catch((e) => {
    console.error("DR VERIFY ERROR:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
