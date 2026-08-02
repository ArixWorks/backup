// One-off: apply prisma/sql/orders-lifecycle.sql statement-by-statement with
// autocommit (ALTER TYPE ... ADD VALUE cannot run inside a transaction).
import { readFileSync } from "node:fs"
import pg from "pg"

const sql = readFileSync("prisma/sql/orders-lifecycle.sql", "utf8")

// Split on semicolons that terminate a statement, but keep DO $$ ... $$ blocks
// intact (they contain semicolons). Simple state machine over $$ dollar-quotes.
function splitStatements(src) {
  const out = []
  let buf = ""
  let inDollar = false
  const lines = src.split("\n")
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith("--")) continue // drop comment-only lines
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

const client = new pg.Client({ connectionString: process.env.POSTGRES_URL_NON_POOLING })
await client.connect()
const stmts = splitStatements(sql)
let ok = 0
for (const stmt of stmts) {
  try {
    await client.query(stmt)
    ok++
  } catch (e) {
    console.error("FAILED statement:\n" + stmt.slice(0, 200) + "\n->", e.message)
    await client.end()
    process.exit(1)
  }
}
console.log(`APPLIED_OK ${ok}/${stmts.length} statements`)
await client.end()
process.exit(0)
