import assert from "node:assert/strict"
import { test } from "node:test"
import { parseBackup, toBackupCsv, toBackupJson, type BackupSource } from "./backup"

const row = (overrides: Partial<BackupSource> = {}): BackupSource => ({
  tld: ".com",
  title: "تجاری",
  active: true,
  supported: true,
  premiumEnabled: false,
  basePriceIrt: 890_000n,
  renewalPriceIrt: 950_000n,
  transferPriceIrt: null,
  listPriceIrt: 1_780_000n,
  displayOrder: 3,
  provider: "railway-domains",
  costUsdCents: 1170,
  sellUsdCents: 585,
  marginPercent: 50,
  lastPriceSyncAt: new Date("2026-01-15T10:30:00.000Z"),
  ...overrides,
})

test("JSON round-trip preserves every priced field", () => {
  const [restored] = parseBackup(toBackupJson([row()]))
  assert.equal(restored.tld, ".com")
  assert.equal(restored.title, "تجاری")
  assert.equal(restored.basePriceIrt, 890_000n)
  assert.equal(restored.renewalPriceIrt, 950_000n)
  assert.equal(restored.listPriceIrt, 1_780_000n)
  // The dollar fields anchor the whole catalog; losing them would silently reset
  // pricing on the next sync.
  assert.equal(restored.costUsdCents, 1170)
  assert.equal(restored.sellUsdCents, 585)
  assert.equal(restored.marginPercent, 50)
  assert.equal(restored.displayOrder, 3)
  assert.equal(restored.lastPriceSyncAt?.toISOString(), "2026-01-15T10:30:00.000Z")
})

test("CSV round-trip preserves every priced field", () => {
  const [restored] = parseBackup(toBackupCsv([row()]))
  assert.equal(restored.basePriceIrt, 890_000n)
  assert.equal(restored.costUsdCents, 1170)
  assert.equal(restored.marginPercent, 50)
  assert.equal(restored.active, true)
  assert.equal(restored.premiumEnabled, false)
})

test("nullable money and dates survive as null rather than zero", () => {
  const [restored] = parseBackup(toBackupCsv([row({ transferPriceIrt: null, lastPriceSyncAt: null, costUsdCents: null })]))
  assert.equal(restored.transferPriceIrt, null)
  assert.equal(restored.lastPriceSyncAt, null)
  assert.equal(restored.costUsdCents, null)
})

test("a title containing a comma is not split into two columns", () => {
  const csv = toBackupCsv([row({ title: "تجاری, عمومی" })])
  const [restored] = parseBackup(csv)
  assert.equal(restored.title, "تجاری, عمومی")
  assert.equal(restored.basePriceIrt, 890_000n)
})

test("a title containing quotes round-trips", () => {
  const [restored] = parseBackup(toBackupCsv([row({ title: 'دامنه "ویژه"' })]))
  assert.equal(restored.title, 'دامنه "ویژه"')
})

test("large Toman amounts keep full precision", () => {
  // Beyond Number.MAX_SAFE_INTEGER territory for cumulative math; BigInt must not
  // degrade to a float on the way through JSON.
  const [restored] = parseBackup(toBackupJson([row({ basePriceIrt: 9_007_199_254_740_993n })]))
  assert.equal(restored.basePriceIrt, 9_007_199_254_740_993n)
})

test("Excel-style booleans and bare TLDs are accepted", () => {
  const rows = parseBackup("tld,title,basePriceIrt,active\ncom,تجاری,890000,TRUE\nnet,شبکه,750000,FALSE")
  assert.equal(rows[0].tld, ".com")
  assert.equal(rows[0].active, true)
  assert.equal(rows[1].tld, ".net")
  assert.equal(rows[1].active, false)
})

test("a partial CSV keeps schema defaults for absent columns", () => {
  const [restored] = parseBackup("tld,title,basePriceIrt\n.org,سازمانی,700000")
  assert.equal(restored.active, true)
  assert.equal(restored.supported, true)
  assert.equal(restored.provider, "railway-domains")
  assert.equal(restored.costUsdCents, null)
})

test("BOM-prefixed CSV from Excel parses", () => {
  const rows = parseBackup(`\uFEFF${toBackupCsv([row()])}`)
  assert.equal(rows[0].tld, ".com")
})

test("a bare JSON array is accepted alongside the wrapped export", () => {
  const wrapped: { tlds: unknown[] } = JSON.parse(toBackupJson([row()]))
  const rows = parseBackup(JSON.stringify(wrapped.tlds))
  assert.equal(rows[0].tld, ".com")
})

test("duplicate TLDs are rejected before any write", () => {
  assert.throws(
    () => parseBackup("tld,title,basePriceIrt\n.com,تجاری,890000\n.com,تجاری۲,900000"),
    /تکراری/,
  )
})

test("an invalid row is rejected with its row number", () => {
  assert.throws(() => parseBackup("tld,title,basePriceIrt\n.com,تجاری,890000\n.net,شبکه,0"), /ردیف ۲|ردیف 2/)
})

test("a CSV without a tld column is rejected", () => {
  assert.throws(() => parseBackup("title,basePriceIrt\nتجاری,890000"), /tld/)
})

test("empty input is rejected", () => {
  assert.throws(() => parseBackup("   "), /خالی/)
})

test("export includes a version so a future format change is detectable", () => {
  const parsed: { version: number; kind: string; count: number } = JSON.parse(toBackupJson([row(), row({ tld: ".net" })]))
  assert.equal(parsed.version, 1)
  assert.equal(parsed.kind, "domain-tld-catalog")
  assert.equal(parsed.count, 2)
})
