/**
 * Standalone CLI restore. DESTRUCTIVE: wipes the target database and replaces
 * it with the contents of a backup file produced by `pnpm db:backup`.
 *
 *   CONFIRM_RESTORE=ERASE pnpm db:restore ./backups/subio-backup-<ts>.json.gz
 *
 * Run `prisma migrate deploy` first so the schema exists on the target DB.
 */
import { readFileSync, existsSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import { createHash } from "node:crypto"
import { Prisma, PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const SUPPORTED_FORMATS = new Set<number>([2, 3])

function replacer(_k: string, v: unknown) {
  return typeof v === "bigint" ? { __t: "bigint", v: v.toString() } : v
}

function topoSorted(): { name: string; delegate: string }[] {
  const models = Prisma.dmmf.datamodel.models
  const deps = new Map<string, Set<string>>()
  for (const m of models) {
    const s = new Set<string>()
    for (const f of m.fields) {
      if (f.kind === "object" && f.relationFromFields?.length && f.type !== m.name) s.add(f.type)
    }
    deps.set(m.name, s)
  }
  const ordered: string[] = []
  const placed = new Set<string>()
  let guard = 0
  while (ordered.length < models.length && guard++ < models.length + 5) {
    for (const m of models) {
      if (placed.has(m.name)) continue
      if ([...deps.get(m.name)!].every((d) => placed.has(d))) {
        ordered.push(m.name)
        placed.add(m.name)
      }
    }
  }
  for (const m of models) if (!placed.has(m.name)) ordered.push(m.name)
  return ordered.map((name) => ({ name, delegate: name.charAt(0).toLowerCase() + name.slice(1) }))
}

function deepRevive(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(deepRevive)
  if (obj && typeof obj === "object") {
    const t = obj as Record<string, unknown>
    if (t.__t === "bigint") return BigInt(t.v as string)
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(t)) out[k] = deepRevive(v)
    return out
  }
  return obj
}

async function main() {
  const file = process.argv[2]
  if (!file) {
    console.error("usage: CONFIRM_RESTORE=ERASE pnpm db:restore <file.json.gz>")
    process.exit(1)
  }
  if (process.env.CONFIRM_RESTORE !== "ERASE") {
    console.error("⛔ refusing to restore. Set CONFIRM_RESTORE=ERASE to confirm (this WIPES the database).")
    process.exit(1)
  }
  if (!existsSync(file)) {
    console.error(`❌ backup file not found: ${file}`)
    process.exit(1)
  }

  // Validate BEFORE touching the DB: gunzip, parse, version, checksum.
  let raw: string
  try {
    raw = gunzipSync(readFileSync(file)).toString("utf8")
  } catch {
    console.error("❌ corrupted backup: failed to gunzip (invalid gzip).")
    process.exit(1)
  }
  let parsed: {
    format?: number
    checksum?: string
    order?: string[]
    tables?: Record<string, number>
    data: Record<string, Record<string, unknown>[]>
  }
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.error("❌ corrupted backup: invalid JSON.")
    process.exit(1)
  }
  if (parsed.format == null || !SUPPORTED_FORMATS.has(parsed.format)) {
    console.error(`❌ unsupported backup format version: ${String(parsed.format)}`)
    process.exit(1)
  }
  if (!parsed.data || typeof parsed.data !== "object") {
    console.error("❌ invalid backup: no data found.")
    process.exit(1)
  }
  if (parsed.checksum) {
    const recomputed = createHash("sha256")
      .update(JSON.stringify({ order: parsed.order, tables: parsed.tables, data: parsed.data }, replacer))
      .digest("hex")
    if (recomputed !== parsed.checksum) {
      console.error("❌ checksum mismatch — refusing to restore corrupted/tampered backup.")
      process.exit(1)
    }
    console.log(`✓ checksum verified: ${parsed.checksum.slice(0, 16)}…`)
  }
  const models = topoSorted()
  const order = parsed.order?.length ? parsed.order : models.map((m) => m.name)
  const delegateOf = new Map(models.map((m) => [m.name, m.delegate]))
  const revived = deepRevive(parsed.data) as Record<string, Record<string, unknown>[]>

  const referrals: { id: unknown; referredById: unknown }[] = []
  for (const u of revived["User"] ?? []) {
    if (u.referredById != null) referrals.push({ id: u.id, referredById: u.referredById })
  }

  const tableList = models.map((m) => `"${m.name}"`).join(", ")
  let total = 0

  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE;`)
      for (const name of order) {
        const rows = revived[name]
        if (!rows?.length) continue
        const client = (tx as any)[delegateOf.get(name)!]
        if (!client?.createMany) continue
        const toInsert = name === "User" ? rows.map((r) => ({ ...r, referredById: null })) : rows
        const res = await client.createMany({ data: toInsert, skipDuplicates: true })
        total += res.count
        console.log(`  ${name}: ${res.count}`)
      }
      for (const link of referrals) {
        await tx.user.update({ where: { id: link.id as string }, data: { referredById: link.referredById as string } }).catch(() => {})
      }
    },
    { timeout: 120_000, maxWait: 10_000 },
  )

  console.log(`✅ restore complete: ${total.toLocaleString()} rows`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error("❌ restore failed:", e.message)
  await prisma.$disconnect()
  process.exit(1)
})
