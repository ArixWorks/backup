import "server-only"
import { gzipSync, gunzipSync } from "node:zlib"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

/**
 * Logical database backup/restore.
 *
 * Why logical (Prisma) instead of pg_dump: it has ZERO external binary
 * dependency, so it runs identically on a serverless platform, a fresh VPS, or
 * a laptop — you only need the app + DATABASE_URL. The output is a single
 * gzipped JSON file containing every row of every table, restorable onto any
 * empty Postgres that has the schema migrated (`prisma migrate deploy`).
 *
 * Captures EVERYTHING the bot records: users, wallets, ledger, orders,
 * products, auctions, bids, deposits/withdrawals, giveaways, gamification,
 * settings, support tickets, monitoring — all 45 models.
 */

export const BACKUP_FORMAT_VERSION = 2

/** A model whose rows we will dump/restore, with its Prisma delegate name. */
type ModelMeta = {
  /** Prisma model name (PascalCase), e.g. "User". */
  name: string
  /** Delegate key on the client (camelCase), e.g. "user". */
  delegate: string
}

/**
 * Build a FK-safe insertion order from Prisma's DMMF: model A must come AFTER
 * every model it holds a foreign key to. Self-references are ignored here and
 * handled with a second update pass during restore (only User.referredById).
 */
function topoSortedModels(): ModelMeta[] {
  const models = Prisma.dmmf.datamodel.models
  const nameToDeps = new Map<string, Set<string>>()
  for (const m of models) {
    const deps = new Set<string>()
    for (const f of m.fields) {
      if (f.kind === "object" && f.relationFromFields && f.relationFromFields.length > 0) {
        if (f.type !== m.name) deps.add(f.type) // skip self-reference
      }
    }
    nameToDeps.set(m.name, deps)
  }
  const ordered: string[] = []
  const placed = new Set<string>()
  // Kahn-style: repeatedly place models whose deps are all already placed.
  let guard = 0
  while (ordered.length < models.length && guard++ < models.length + 5) {
    for (const m of models) {
      if (placed.has(m.name)) continue
      const deps = nameToDeps.get(m.name)!
      if ([...deps].every((d) => placed.has(d) || d === m.name)) {
        ordered.push(m.name)
        placed.add(m.name)
      }
    }
  }
  // Any leftover (cyclic beyond self-ref) appended as-is.
  for (const m of models) if (!placed.has(m.name)) ordered.push(m.name)

  return ordered.map((name) => ({
    name,
    delegate: name.charAt(0).toLowerCase() + name.slice(1),
  }))
}

/** Tag used to round-trip BigInt and Date through JSON without precision loss. */
function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return { __t: "bigint", v: value.toString() }
  return value
}

function reviveValue(value: unknown): unknown {
  if (value && typeof value === "object" && "__t" in (value as Record<string, unknown>)) {
    const tagged = value as { __t: string; v: string }
    if (tagged.__t === "bigint") return BigInt(tagged.v)
  }
  // ISO date strings are revived by Prisma automatically on write; leave as-is.
  return value
}

function deepRevive(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(deepRevive)
  if (obj && typeof obj === "object") {
    const tagged = obj as Record<string, unknown>
    if ("__t" in tagged) return reviveValue(obj)
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(tagged)) out[k] = deepRevive(v)
    return out
  }
  return obj
}

export type BackupMeta = {
  filename: string
  sizeBytes: number
  totalRows: number
  createdAt: string
  tables: Record<string, number>
}

export type BackupResult = BackupMeta & { buffer: Buffer }

/**
 * Create a complete, gzipped logical backup of the database.
 * Returns the compressed buffer plus metadata (row counts, size).
 */
export async function createBackup(): Promise<BackupResult> {
  const models = topoSortedModels()
  const data: Record<string, unknown[]> = {}
  const tables: Record<string, number> = {}
  let totalRows = 0

  for (const m of models) {
    const delegate = (prisma as unknown as Record<string, { findMany: (a: unknown) => Promise<unknown[]> }>)[
      m.delegate
    ]
    if (!delegate?.findMany) continue
    const rows = await delegate.findMany({})
    data[m.name] = rows
    tables[m.name] = rows.length
    totalRows += rows.length
  }

  const payload = {
    format: BACKUP_FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    order: models.map((m) => m.name),
    tables,
    data,
  }

  const json = JSON.stringify(payload, jsonReplacer)
  const buffer = gzipSync(Buffer.from(json, "utf8"), { level: 9 })
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)

  return {
    buffer,
    filename: `subio-backup-${stamp}.json.gz`,
    sizeBytes: buffer.byteLength,
    totalRows,
    createdAt: payload.createdAt,
    tables,
  }
}

export type RestoreSummary = {
  totalRows: number
  tables: Record<string, number>
  createdAt: string
}

/**
 * Restore a backup buffer onto the current database. THIS IS DESTRUCTIVE: it
 * wipes all existing rows (TRUNCATE ... CASCADE) and replaces them with the
 * backup contents. Intended for disaster recovery / VPS migration.
 *
 * Strategy:
 *  1. TRUNCATE every table (CASCADE, RESTART IDENTITY) in one statement.
 *  2. Insert rows in FK-safe topological order.
 *  3. For User.referredById (the only self-reference), insert with it nulled,
 *     then update in a second pass so inviter links are preserved.
 */
export async function restoreBackup(buffer: Buffer): Promise<RestoreSummary> {
  const json = gunzipSync(buffer).toString("utf8")
  const parsed = JSON.parse(json) as {
    format?: number
    createdAt?: string
    order?: string[]
    data?: Record<string, Record<string, unknown>[]>
  }
  if (!parsed?.data || typeof parsed.data !== "object") {
    throw new Error("فایل پشتیبان نامعتبر است (داده‌ای یافت نشد)")
  }

  const models = topoSortedModels()
  const order = parsed.order && parsed.order.length ? parsed.order : models.map((m) => m.name)
  const delegateOf = new Map(models.map((m) => [m.name, m.delegate]))

  const revived = deepRevive(parsed.data) as Record<string, Record<string, unknown>[]>

  // Capture inviter links to re-apply after all users exist.
  const userReferrals: { id: unknown; referredById: unknown }[] = []
  for (const u of revived["User"] ?? []) {
    if (u.referredById != null) userReferrals.push({ id: u.id, referredById: u.referredById })
  }

  let totalRows = 0
  const tables: Record<string, number> = {}

  // Quote every table so PascalCase identifiers survive in Postgres.
  const tableList = models.map((m) => `"${m.name}"`).join(", ")

  await prisma.$transaction(
    async (tx) => {
      // 1. Wipe everything atomically.
      await tx.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE;`)

      // 2. Insert in topological order.
      for (const name of order) {
        const rows = revived[name]
        if (!rows || rows.length === 0) {
          tables[name] = 0
          continue
        }
        const delegate = delegateOf.get(name)
        if (!delegate) continue
        const client = (tx as unknown as Record<string, { createMany?: (a: unknown) => Promise<{ count: number }> }>)[
          delegate
        ]
        if (!client?.createMany) continue

        // Null the only self-FK on first pass; restored in pass 3.
        const toInsert =
          name === "User"
            ? rows.map((r) => ({ ...r, referredById: null }))
            : rows

        const res = await client.createMany({ data: toInsert as never, skipDuplicates: true })
        tables[name] = res.count
        totalRows += res.count
      }

      // 3. Re-apply inviter self-references.
      for (const link of userReferrals) {
        await tx.user.update({
          where: { id: link.id as string },
          data: { referredById: link.referredById as string },
        }).catch(() => {})
      }
    },
    { timeout: 120_000, maxWait: 10_000 },
  )

  return { totalRows, tables, createdAt: parsed.createdAt ?? "" }
}
