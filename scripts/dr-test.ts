/**
 * FULL DISASTER-RECOVERY SIMULATION.
 *
 * Proves the backup system end-to-end WITHOUT touching the live `public` data:
 *   1. `dr_source` schema  = simulated PRODUCTION (real data + extra entities)
 *   2. backup dr_source     = the production backup file (gzip + sha256)
 *   3. Telegram delivery     = send file to admin, re-download, verify integrity
 *   4. `dr_fresh` schema    = simulated BRAND-NEW VPS (migrated, empty)
 *   5. restore into dr_fresh ONLY from the backup
 *   6. deep verify dr_fresh == dr_source (counts, row hashes, FKs, finances)
 *   7. edge cases + performance + report
 *
 * Run:  set -a && source /vercel/share/.env.project && set +a && \
 *       pnpm exec tsx scripts/dr-test.ts
 */
import { execSync } from "node:child_process"
import { gzipSync, gunzipSync } from "node:zlib"
import { createHash } from "node:crypto"
import { Prisma, PrismaClient } from "@prisma/client"

const FORMAT_VERSION = 3
const SUPPORTED_FORMATS = new Set<number>([2, 3])
const BOT = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || ""
const ADMIN_CHAT = process.env.DR_TEST_CHAT_ID || "1645353710"

// ----------------------------- helpers --------------------------------------
// The Prisma datasource uses POSTGRES_PRISMA_URL (pooled) for the client and
// POSTGRES_URL_NON_POOLING for migrations/db push. We base isolated schemas on
// the DIRECT (non-pooling) URL: it supports search_path + transactional bulk
// inserts reliably, unlike the PgBouncer pooler.
const BASE_URL = (process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL) as string
function schemaUrl(schema: string): string {
  const u = new URL(BASE_URL)
  u.searchParams.set("schema", schema)
  return u.toString()
}
function bigintReplacer(_k: string, v: unknown) {
  return typeof v === "bigint" ? { __t: "bigint", v: v.toString() } : v
}
function deepRevive(o: unknown): unknown {
  if (Array.isArray(o)) return o.map(deepRevive)
  if (o && typeof o === "object") {
    const t = o as Record<string, unknown>
    if (t.__t === "bigint") return BigInt(t.v as string)
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(t)) out[k] = deepRevive(v)
    return out
  }
  return o
}
/** Stable stringify: recursively sorted keys, so row hashes are order-stable. */
function canonical(o: unknown): string {
  if (typeof o === "bigint") return `B:${o}`
  if (o === null || typeof o !== "object") return JSON.stringify(o)
  if (Array.isArray(o)) return `[${o.map(canonical).join(",")}]`
  if (o instanceof Date) return `D:${o.toISOString()}`
  const ks = Object.keys(o as Record<string, unknown>).sort()
  return `{${ks.map((k) => JSON.stringify(k) + ":" + canonical((o as Record<string, unknown>)[k])).join(",")}}`
}
function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex")
}
function topo(): { name: string; delegate: string }[] {
  const models = Prisma.dmmf.datamodel.models
  const deps = new Map<string, Set<string>>()
  for (const m of models) {
    const s = new Set<string>()
    for (const f of m.fields) if (f.kind === "object" && f.relationFromFields?.length && f.type !== m.name) s.add(f.type)
    deps.set(m.name, s)
  }
  const ordered: string[] = []
  const placed = new Set<string>()
  let g = 0
  while (ordered.length < models.length && g++ < models.length + 5)
    for (const m of models) {
      if (placed.has(m.name)) continue
      if ([...deps.get(m.name)!].every((d) => placed.has(d))) ordered.push(m.name), placed.add(m.name)
    }
  for (const m of models) if (!placed.has(m.name)) ordered.push(m.name)
  return ordered.map((name) => ({ name, delegate: name.charAt(0).toLowerCase() + name.slice(1) }))
}
const MODELS = topo()
const delegateOf = new Map(MODELS.map((m) => [m.name, m.delegate]))

// ----------------------------- backup / restore -----------------------------
async function backup(client: PrismaClient) {
  const data: Record<string, unknown[]> = {}
  const tables: Record<string, number> = {}
  let total = 0
  for (const m of MODELS) {
    const d = (client as any)[m.delegate]
    if (!d?.findMany) continue
    const rows = await d.findMany({})
    data[m.name] = rows
    tables[m.name] = rows.length
    total += rows.length
  }
  const order = MODELS.map((m) => m.name)
  const checksum = sha256(JSON.stringify({ order, tables, data }, bigintReplacer))
  const payload = { format: FORMAT_VERSION, createdAt: new Date().toISOString(), checksum, order, tables, data }
  const buffer = gzipSync(Buffer.from(JSON.stringify(payload, bigintReplacer), "utf8"), { level: 9 })
  return { buffer, checksum, total, tables, sizeBytes: buffer.byteLength }
}
function verify(buffer: Buffer) {
  let json: string
  try {
    json = gunzipSync(buffer).toString("utf8")
  } catch {
    throw new Error("gunzip failed (corrupted gzip)")
  }
  let p: any
  try {
    p = JSON.parse(json)
  } catch {
    throw new Error("invalid JSON")
  }
  if (p.format == null || !SUPPORTED_FORMATS.has(p.format)) throw new Error(`unsupported format ${p.format}`)
  if (!p.data) throw new Error("no data")
  if (p.checksum) {
    const re = sha256(JSON.stringify({ order: p.order, tables: p.tables, data: p.data }, bigintReplacer))
    if (re !== p.checksum) throw new Error("checksum mismatch")
  }
  return p
}
async function restore(client: PrismaClient, buffer: Buffer) {
  const parsed = verify(buffer)
  const order: string[] = parsed.order?.length ? parsed.order : MODELS.map((m) => m.name)
  const revived = deepRevive(parsed.data) as Record<string, Record<string, unknown>[]>
  const referrals: { id: unknown; referredById: unknown; updatedAt: unknown }[] = []
  for (const u of revived["User"] ?? [])
    if (u.referredById != null) referrals.push({ id: u.id, referredById: u.referredById, updatedAt: u.updatedAt })
  const tableList = MODELS.map((m) => `"${m.name}"`).join(", ")
  let total = 0
  await client.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE;`)
      for (const name of order) {
        const rows = revived[name]
        if (!rows?.length) continue
        const c = (tx as any)[delegateOf.get(name)!]
        if (!c?.createMany) continue
        const toInsert = name === "User" ? rows.map((r) => ({ ...r, referredById: null })) : rows
        const res = await c.createMany({ data: toInsert, skipDuplicates: true })
        total += res.count
      }
      for (const l of referrals)
        await tx.user
          .update({
            where: { id: l.id as string },
            data: {
              referredById: l.referredById as string,
              ...(l.updatedAt != null ? { updatedAt: l.updatedAt as Date } : {}),
            },
          })
          .catch(() => {})
    },
    { timeout: 180_000, maxWait: 15_000 },
  )
  return total
}

// ----------------------------- seed extra entities --------------------------
async function seedExtras(src: PrismaClient) {
  const users = await src.user.findMany({ take: 5, select: { id: true, telegramId: true } })
  const product = await src.product.findFirst({ select: { id: true } })
  if (users.length < 2) return
  const now = Date.now()

  // Giveaway + entries + winner
  const gw = await src.giveaway.create({
    data: {
      slug: "dr-giveaway-" + now,
      title: "قرعه‌کشی ویژه DR",
      prizeLabel: "۱,۰۰۰,۰۰۰ تومان اعتبار",
      prizeKind: "WALLET",
      prizeAmount: 1_000_000n,
      winnersCount: 1,
      startAt: new Date(now - 86400000),
      endAt: new Date(now + 86400000),
      drawAt: new Date(now + 2 * 86400000),
      status: "ACTIVE",
    },
  })
  for (const u of users) await src.giveawayEntry.create({ data: { giveawayId: gw.id, userId: u.id, telegramId: u.telegramId } })
  const firstEntry = await src.giveawayEntry.findFirst({ where: { giveawayId: gw.id } })
  if (firstEntry)
    await src.giveawayWinner.create({
      data: { giveawayId: gw.id, entryId: firstEntry.id, userId: firstEntry.userId, position: 1, delivered: true, deliveredAt: new Date() },
    })

  // Support ticket + messages
  const t = await src.supportTicket.create({
    data: { publicId: "DR-" + now, userId: users[0].id, subject: "مشکل در پرداخت", category: "PAYMENT", status: "ANSWERED" },
  })
  await src.ticketMessage.create({ data: { ticketId: t.id, authorId: users[0].id, body: "سلام، پرداختم ثبت نشد." } })
  await src.ticketMessage.create({ data: { ticketId: t.id, fromStaff: true, body: "بررسی شد و اعتبار اضافه گردید." } })

  // Alert rule + event
  const rule = await src.alertRule.create({
    data: { name: "خطای بالای ۵٪", metric: "error_rate", comparator: "GT", threshold: 5, severity: "CRITICAL", channels: ["telegram", "dashboard"] },
  })
  await src.alertEvent.create({
    data: { ruleId: rule.id, title: "نرخ خطا بالا رفت", severity: "CRITICAL", status: "RESOLVED", metric: "error_rate", value: 7.2, message: "error_rate=7.2%", resolvedAt: new Date() },
  })

  // Point ledger + notifications
  for (const u of users.slice(0, 3))
    await src.pointLedger.create({ data: { userId: u.id, delta: 50, balanceAfter: 50, reason: "PURCHASE" } })
  for (const u of users.slice(0, 2))
    await src.notification.create({ data: { userId: u.id, type: "GIVEAWAY_WON", title: "برنده شدید!", body: "در قرعه‌کشی DR برنده شدید." } })
}

// ----------------------------- deep verify ----------------------------------
async function tableHashes(client: PrismaClient) {
  const out: Record<string, { count: number; hash: string }> = {}
  for (const m of MODELS) {
    const d = (client as any)[m.delegate]
    if (!d?.findMany) continue
    const rows: unknown[] = await d.findMany({})
    const canon = rows.map(canonical).sort()
    out[m.name] = { count: rows.length, hash: sha256(canon.join("|")) }
  }
  return out
}
async function fkIntegrity(client: PrismaClient) {
  // For every relation FK, ensure each non-null value points to an existing row.
  const broken: string[] = []
  for (const m of Prisma.dmmf.datamodel.models) {
    for (const f of m.fields) {
      if (f.kind !== "object" || !f.relationFromFields?.length || f.type === m.name) continue
      const fromField = f.relationFromFields[0]
      const toField = (f.relationToFields?.[0] as string) || "id"
      const childDelegate = m.name.charAt(0).toLowerCase() + m.name.slice(1)
      const parentDelegate = f.type.charAt(0).toLowerCase() + f.type.slice(1)
      const child = (client as any)[childDelegate]
      const parent = (client as any)[parentDelegate]
      if (!child?.findMany || !parent?.findMany) continue
      const childRows: any[] = await child.findMany({ select: { [fromField]: true } })
      const vals = [...new Set(childRows.map((r) => r[fromField]).filter((v) => v != null))]
      if (!vals.length) continue
      const found: any[] = await parent.findMany({ where: { [toField]: { in: vals } }, select: { [toField]: true } })
      const foundSet = new Set(found.map((r) => r[toField]))
      const missing = vals.filter((v) => !foundSet.has(v))
      if (missing.length) broken.push(`${m.name}.${fromField} -> ${f.type}.${toField}: ${missing.length} dangling`)
    }
  }
  return broken
}
async function finances(client: PrismaClient) {
  const accts = await client.ledgerAccount.findMany({ select: { balance: true } })
  const ledgerSum = accts.reduce((a, x) => a + x.balance, 0n)
  const wallets = await client.wallet.findMany({ select: { totalBalance: true } })
  const walletTotal = wallets.reduce((a, x) => a + x.totalBalance, 0n)
  const legs = await client.ledgerLeg.aggregate({ _sum: { amount: true } }).catch(() => ({ _sum: { amount: 0n } }))
  return { ledgerSum, walletTotal, legSum: legs._sum.amount ?? 0n }
}

// ----------------------------- telegram -------------------------------------
async function telegramRoundTrip(buffer: Buffer, filename: string, checksum: string) {
  if (!BOT) return { ok: false, reason: "no bot token" }
  const form = new FormData()
  form.append("chat_id", ADMIN_CHAT)
  form.append("caption", `🧪 DR-TEST backup\n🔐 ${checksum.slice(0, 16)}…\n(این یک فایل آزمایشی Disaster Recovery است)`)
  form.append("document", new Blob([new Uint8Array(buffer)], { type: "application/gzip" }), filename)
  const send = await fetch(`https://api.telegram.org/bot${BOT}/sendDocument`, { method: "POST", body: form })
  const sj: any = await send.json()
  if (!sj.ok) return { ok: false, reason: "sendDocument: " + sj.description }
  const fileId = sj.result?.document?.file_id
  // Re-download and verify integrity end-to-end.
  const gf: any = await (await fetch(`https://api.telegram.org/bot${BOT}/getFile?file_id=${fileId}`)).json()
  if (!gf.ok) return { ok: true, delivered: true, downloaded: false, reason: "getFile: " + gf.description }
  const dl = await fetch(`https://api.telegram.org/file/bot${BOT}/${gf.result.file_path}`)
  const back = Buffer.from(await dl.arrayBuffer())
  let integrity = false
  try {
    const p = verify(back)
    integrity = p.checksum === checksum && back.byteLength === buffer.byteLength
  } catch {
    integrity = false
  }
  return { ok: true, delivered: true, downloaded: true, integrity, bytesSent: buffer.byteLength, bytesBack: back.byteLength }
}

// ----------------------------- main ------------------------------------------
function drop(schema: string) {
  const c = new PrismaClient({ datasources: { db: { url: schemaUrl(schema) } } })
  return c.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE;`).finally(() => c.$disconnect())
}
function push(url: string) {
  // Override BOTH datasource vars (client url + directUrl) so push targets the
  // isolated schema instead of the public one Prisma would otherwise read.
  execSync("pnpm exec prisma db push --skip-generate --accept-data-loss", {
    env: { ...process.env, POSTGRES_PRISMA_URL: url, POSTGRES_URL_NON_POOLING: url, DATABASE_URL: url },
    stdio: "ignore",
  })
}

async function main() {
  const R: string[] = []
  const log = (s = "") => (R.push(s), console.log(s))
  const t0 = Date.now()

  log("=".repeat(64))
  log("  DISASTER RECOVERY SIMULATION")
  log("=".repeat(64))

  // PHASE 1 — build simulated production in dr_source from REAL public data + extras
  log("\n[Phase 1] ساخت داده‌ی production شبیه‌سازی‌شده در dr_source")
  await drop("dr_source")
  push(schemaUrl("dr_source"))
  const pub = new PrismaClient() // public (real data)
  const src = new PrismaClient({ datasources: { db: { url: schemaUrl("dr_source") } } })
  const pubBackup = await backup(pub)
  await restore(src, pubBackup.buffer)
  await seedExtras(src)
  const srcHashes = await tableHashes(src)
  const srcFin = await finances(src)
  const srcTotal = Object.values(srcHashes).reduce((a, x) => a + x.count, 0)
  const nonEmpty = Object.entries(srcHashes).filter(([, v]) => v.count > 0).length
  log(`  ✓ ${srcTotal.toLocaleString()} رکورد در ${nonEmpty} جدول (از ${MODELS.length} مدل)`)

  // PHASE 2 — backup
  log("\n[Phase 2] گرفتن بکاپ production")
  const tB = Date.now()
  const b = await backup(src)
  const backupMs = Date.now() - tB
  const ratio = (pubBackup.total > 0 ? b.sizeBytes : b.sizeBytes) // size already compressed
  log(`  ✓ ${b.total.toLocaleString()} رکورد | ${(b.sizeBytes / 1024).toFixed(1)} KB فشرده | ${backupMs}ms`)
  log(`  ✓ sha256: ${b.checksum.slice(0, 24)}…`)

  // PHASE 2b — Telegram delivery + re-download + integrity
  log("\n[Phase 2b] تحویل تلگرام + دانلود مجدد + بررسی صحت")
  const tg = await telegramRoundTrip(b.buffer, `dr-test-${Date.now()}.json.gz`, b.checksum)
  log(`  Telegram: ${JSON.stringify(tg)}`)

  // PHASE 3 + 4 — fresh VPS + restore ONLY from backup
  log("\n[Phase 3/4] VPS تازه (dr_fresh) + بازیابی فقط از روی بکاپ")
  await drop("dr_fresh")
  push(schemaUrl("dr_fresh"))
  const fresh = new PrismaClient({ datasources: { db: { url: schemaUrl("dr_fresh") } } })
  const tR = Date.now()
  const restored = await restore(fresh, b.buffer)
  const restoreMs = Date.now() - tR
  log(`  ✓ ${restored.toLocaleString()} رکورد بازیابی شد در ${restoreMs}ms`)

  // PHASE 5/7 — deep verify
  log("\n[Phase 5/7] راستی‌آزمایی عمیق (counts + row hashes + FK + finances)")
  const freshHashes = await tableHashes(fresh)
  const freshFin = await finances(fresh)
  let mismatches = 0
  let countMismatch = 0
  const diffs: string[] = []
  for (const m of MODELS) {
    const s = srcHashes[m.name]
    const f = freshHashes[m.name]
    if (!s || !f) continue
    if (s.count !== f.count) countMismatch++, diffs.push(`${m.name}: count ${s.count}->${f.count}`)
    else if (s.hash !== f.hash) mismatches++, diffs.push(`${m.name}: hash mismatch (count ${s.count})`)
  }
  const fkBroken = await fkIntegrity(fresh)
  const verifiedTables = MODELS.filter((m) => srcHashes[m.name] && freshHashes[m.name]).length
  const okTables = verifiedTables - countMismatch - mismatches
  const pct = ((okTables / verifiedTables) * 100).toFixed(2)

  log(`  جداول تأییدشده: ${okTables}/${verifiedTables} (${pct}%)`)
  log(`  اختلاف تعداد: ${countMismatch} | اختلاف هش: ${mismatches}`)
  log(`  FK شکسته: ${fkBroken.length}`)
  log(`  مالی src : ledger=${srcFin.ledgerSum} wallet=${srcFin.walletTotal} legs=${srcFin.legSum}`)
  log(`  مالی fresh: ledger=${freshFin.ledgerSum} wallet=${freshFin.walletTotal} legs=${freshFin.legSum}`)
  const finOk = srcFin.ledgerSum === freshFin.ledgerSum && srcFin.walletTotal === freshFin.walletTotal && srcFin.legSum === freshFin.legSum
  if (diffs.length) log("  diffs: " + diffs.slice(0, 10).join(" | "))

  // PHASE 8 — edge cases
  log("\n[Phase 8] حالت‌های لبه (باید همه graceful رد شوند)")
  const edge: Record<string, string> = {}
  // corrupted gzip
  try {
    verify(Buffer.from("not a gzip file"))
    edge.corrupted = "FAIL (accepted)"
  } catch {
    edge.corrupted = "OK (rejected)"
  }
  // truncated/invalid JSON inside valid gzip
  try {
    verify(gzipSync(Buffer.from("{ broken json")))
    edge.invalidJson = "FAIL (accepted)"
  } catch {
    edge.invalidJson = "OK (rejected)"
  }
  // wrong format version
  try {
    verify(gzipSync(Buffer.from(JSON.stringify({ format: 999, data: {}, order: [], tables: {} }))))
    edge.wrongVersion = "FAIL (accepted)"
  } catch {
    edge.wrongVersion = "OK (rejected)"
  }
  // tampered checksum
  try {
    const tampered = gzipSync(Buffer.from(JSON.stringify({ format: 3, checksum: "deadbeef", order: [], tables: {}, data: { User: [{ id: "x" }] } })))
    verify(tampered)
    edge.tamperedChecksum = "FAIL (accepted)"
  } catch {
    edge.tamperedChecksum = "OK (rejected)"
  }
  // empty database backup -> restore round trip
  try {
    await drop("dr_empty")
    push(schemaUrl("dr_empty"))
    const empty = new PrismaClient({ datasources: { db: { url: schemaUrl("dr_empty") } } })
    const eb = await backup(empty)
    const er = await restore(empty, eb.buffer)
    edge.emptyDb = er === 0 ? "OK (0 rows round-trip)" : `WARN (${er} rows)`
    await empty.$disconnect()
    await drop("dr_empty")
  } catch (e) {
    edge.emptyDb = "FAIL: " + (e as Error).message
  }
  for (const [k, v] of Object.entries(edge)) log(`  ${k}: ${v}`)

  // PHASE 9 — performance
  log("\n[Phase 9] کارایی")
  const mem = process.memoryUsage()
  log(`  backup: ${backupMs}ms | restore: ${restoreMs}ms | size: ${(b.sizeBytes / 1024).toFixed(1)} KB | heap: ${(mem.heapUsed / 1048576).toFixed(1)} MB`)

  // FINAL REPORT
  const allOk = countMismatch === 0 && mismatches === 0 && fkBroken.length === 0 && finOk && srcTotal === restored
  const edgeOk = Object.values(edge).every((v) => v.startsWith("OK"))
  log("\n" + "=".repeat(64))
  log("  گزارش نهایی Disaster Recovery")
  log("=".repeat(64))
  log(`  رکوردهای بکاپ‌شده     : ${srcTotal.toLocaleString()}`)
  log(`  رکوردهای بازیابی‌شده   : ${restored.toLocaleString()}`)
  log(`  درصد تأیید جداول       : ${pct}%`)
  log(`  رکوردهای گم‌شده        : ${countMismatch === 0 ? 0 : "بله (" + countMismatch + " جدول)"}`)
  log(`  رکوردهای خراب          : ${mismatches}`)
  log(`  FK شکسته               : ${fkBroken.length}`)
  log(`  صحت مالی (ledger/wallet): ${finOk ? "منطبق" : "ناهمخوان"}`)
  log(`  مدت بکاپ               : ${backupMs}ms`)
  log(`  مدت بازیابی            : ${restoreMs}ms`)
  log(`  حجم بکاپ               : ${(b.sizeBytes / 1024).toFixed(1)} KB`)
  log(`  تحویل تلگرام           : ${tg.ok ? (tg.integrity ? "موفق + صحت تأیید شد" : "ارسال شد") : "ناموفق: " + (tg as any).reason}`)
  log(`  حالت‌های لبه           : ${edgeOk ? "همه graceful رد شدند" : "بررسی شود"}`)
  log("-".repeat(64))
  log(`  نتیجه: ${allOk && edgeOk ? "✅ بازیابی کامل بدون از دست رفتن داده (PASS)" : "❌ نیازمند بررسی"}`)
  log("=".repeat(64))
  log(`\n  کل زمان: ${((Date.now() - t0) / 1000).toFixed(1)}s`)

  // cleanup
  await pub.$disconnect()
  await src.$disconnect()
  await fresh.$disconnect()
  await drop("dr_source")
  await drop("dr_fresh")
  log("  پاک‌سازی schemaهای آزمایشی انجام شد.")

  if (!(allOk && edgeOk)) process.exit(2)
}

main().catch((e) => {
  console.error("DR-TEST FATAL:", e)
  process.exit(1)
})
