/**
 * Standalone CLI database backup. Writes a gzipped logical dump to ./backups
 * (or the path in BACKUP_OUT). Runs anywhere with DATABASE_URL set — no app
 * server, no pg_dump binary required.
 *
 *   pnpm db:backup                 # -> ./backups/subio-backup-<ts>.json.gz
 *   BACKUP_OUT=/mnt/x.gz pnpm db:backup
 *
 * Restore with: pnpm db:restore <file>
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs"
import { gzipSync } from "node:zlib"
import { Prisma, PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const FORMAT_VERSION = 2

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

function replacer(_k: string, v: unknown) {
  return typeof v === "bigint" ? { __t: "bigint", v: v.toString() } : v
}

async function main() {
  const models = topoSorted()
  const data: Record<string, unknown[]> = {}
  const tables: Record<string, number> = {}
  let total = 0
  for (const m of models) {
    const d = (prisma as any)[m.delegate]
    if (!d?.findMany) continue
    const rows = await d.findMany({})
    data[m.name] = rows
    tables[m.name] = rows.length
    total += rows.length
  }
  const payload = { format: FORMAT_VERSION, createdAt: new Date().toISOString(), order: models.map((m) => m.name), tables, data }
  const buf = gzipSync(Buffer.from(JSON.stringify(payload, replacer), "utf8"), { level: 9 })

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  const out = process.env.BACKUP_OUT ?? `./backups/subio-backup-${stamp}.json.gz`
  if (!process.env.BACKUP_OUT && !existsSync("./backups")) mkdirSync("./backups", { recursive: true })
  writeFileSync(out, buf)

  console.log(`✅ backup written: ${out}`)
  console.log(`   ${total.toLocaleString()} rows, ${(buf.byteLength / 1024).toFixed(1)} KB compressed`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error("❌ backup failed:", e.message)
  await prisma.$disconnect()
  process.exit(1)
})
