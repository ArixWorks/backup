// One-off: apply prisma/sql/orders-lifecycle.sql statement-by-statement via
// Prisma's $executeRawUnsafe (autocommit — required for ALTER TYPE ADD VALUE).
import { readFileSync } from "node:fs"

function splitStatements(src: string): string[] {
  const out: string[] = []
  let buf = ""
  let inDollar = false
  for (const line of src.split("\n")) {
    if (line.trim().startsWith("--")) continue
    buf += line + "\n"
    const dollarCount = (line.match(/\$\$/g) || []).length
    if (dollarCount % 2 === 1) inDollar = !inDollar
    if (!inDollar && line.includes(";") && !line.trimEnd().endsWith("$$")) {
      out.push(buf.trim())
      buf = ""
    }
  }
  if (buf.trim()) out.push(buf.trim())
  return out.filter((s) => s.replace(/;/g, "").trim().length > 0)
}

async function main() {
  const { prisma } = await import("../lib/db")
  const sql = readFileSync("prisma/sql/orders-lifecycle.sql", "utf8")
  const stmts = splitStatements(sql)
  let ok = 0
  for (const stmt of stmts) {
    try {
      await prisma.$executeRawUnsafe(stmt)
      ok++
    } catch (e) {
      console.error("FAILED:\n" + stmt.slice(0, 220) + "\n->", (e as Error).message)
      process.exit(1)
    }
  }
  console.log(`APPLIED_OK ${ok}/${stmts.length} statements`)
  process.exit(0)
}

void main()
