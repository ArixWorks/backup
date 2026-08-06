import { z } from "@/lib/zod"

/**
 * Backup and restore for the TLD catalog (pricing + display settings only).
 *
 * Orders are deliberately excluded: they are transactional history tied to real
 * users and payments, so re-importing them would fabricate sales. This file
 * moves only the catalog rows an admin actually curates.
 *
 * Every field an admin can change is included, not just the four columns the
 * older `importTlds` CSV path handled. A backup that dropped `costUsdCents` or
 * `marginPercent` would look complete and then silently reset the dollar
 * pricing that the whole catalog is anchored to on the next price sync.
 */

/** Column order for CSV. Mirrors the JSON keys so the two formats round-trip identically. */
export const BACKUP_COLUMNS = [
  "tld",
  "title",
  "active",
  "supported",
  "premiumEnabled",
  "basePriceIrt",
  "renewalPriceIrt",
  "transferPriceIrt",
  "listPriceIrt",
  "displayOrder",
  "provider",
  "costUsdCents",
  "sellUsdCents",
  "marginPercent",
  "lastPriceSyncAt",
] as const

export const BACKUP_VERSION = 1

/** The DomainTld shape this module reads. Kept structural so Prisma's row type satisfies it. */
export interface BackupSource {
  tld: string
  title: string
  active: boolean
  supported: boolean
  premiumEnabled: boolean
  basePriceIrt: bigint
  renewalPriceIrt: bigint | null
  transferPriceIrt: bigint | null
  listPriceIrt: bigint | null
  displayOrder: number
  provider: string
  costUsdCents: number | null
  sellUsdCents: number | null
  marginPercent: number | null
  lastPriceSyncAt: Date | null
}

const tldPattern = /^\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

/** Accepts "com" or ".com" from a hand-edited file and normalises to ".com". */
const tldField = z
  .string()
  .trim()
  .toLowerCase()
  .transform((value) => (value.startsWith(".") ? value : `.${value}`))
  .pipe(z.string().regex(tldPattern, "پسوند معتبر نیست."))

/**
 * Booleans arrive as real booleans from JSON but as text from CSV, and Excel is
 * free to write them as `TRUE`/`1`. Empty means "not set", so the row default wins.
 */
const boolField = (fallback: boolean) =>
  z
    .union([z.boolean(), z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === "") return fallback
      if (typeof value === "boolean") return value
      if (typeof value === "number") return value !== 0
      return !["false", "0", "no", "off", "غیرفعال", "خیر"].includes(value.trim().toLowerCase())
    })

/** Toman amounts are BigInt in the database and strings in transit to avoid precision loss. */
const requiredMoney = z.coerce.bigint().positive("قیمت ثبت باید بیشتر از صفر باشد.")
const optionalMoney = z
  .union([z.string(), z.number(), z.bigint(), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === null || value === "") return null
    const parsed = BigInt(typeof value === "number" ? Math.round(value) : String(value).trim())
    return parsed > 0n ? parsed : null
  })

const optionalInt = (max: number) =>
  z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === null || value === "") return null
      const parsed = Math.round(Number(value))
      return Number.isFinite(parsed) ? parsed : null
    })
    .pipe(z.number().int().min(0).max(max).nullable())

const optionalDate = z
  .union([z.string(), z.date(), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === null || value === "") return null
    const parsed = value instanceof Date ? value : new Date(String(value).trim())
    return Number.isNaN(parsed.getTime()) ? null : parsed
  })

export const backupRowSchema = z.object({
  tld: tldField,
  title: z.string().trim().min(1, "عنوان لازم است.").max(80),
  active: boolField(true),
  supported: boolField(true),
  premiumEnabled: boolField(false),
  basePriceIrt: requiredMoney,
  renewalPriceIrt: optionalMoney,
  transferPriceIrt: optionalMoney,
  listPriceIrt: optionalMoney,
  displayOrder: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => (value === undefined || value === "" ? 0 : Math.round(Number(value))))
    .pipe(z.number().int().min(0).max(10_000)),
  provider: z.string().trim().min(1).max(60).optional().transform((value) => value || "railway-domains"),
  costUsdCents: optionalInt(10_000_000),
  sellUsdCents: optionalInt(10_000_000),
  marginPercent: optionalInt(95),
  lastPriceSyncAt: optionalDate,
})

export type BackupRow = z.infer<typeof backupRowSchema>

/** BigInt has no JSON representation, so money and dates are emitted as strings. */
function serializeValue(row: BackupSource, column: (typeof BACKUP_COLUMNS)[number]) {
  const value = row[column]
  if (typeof value === "bigint") return value.toString()
  if (value instanceof Date) return value.toISOString()
  return value
}

export function toBackupRecord(row: BackupSource): Record<string, unknown> {
  return Object.fromEntries(BACKUP_COLUMNS.map((column) => [column, serializeValue(row, column)]))
}

export function toBackupJson(rows: BackupSource[]): string {
  return JSON.stringify(
    { version: BACKUP_VERSION, kind: "domain-tld-catalog", exportedAt: new Date().toISOString(), count: rows.length, tlds: rows.map(toBackupRecord) },
    null,
    2,
  )
}

/** RFC-4180 cell escaping: wrap in quotes and double any embedded quotes. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return ""
  const text = typeof value === "boolean" ? String(value) : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toBackupCsv(rows: BackupSource[]): string {
  const lines = [BACKUP_COLUMNS.join(",")]
  for (const row of rows) lines.push(BACKUP_COLUMNS.map((column) => cell(serializeValue(row, column))).join(","))
  return lines.join("\r\n")
}

/**
 * Splits one CSV line while honouring quoted cells.
 *
 * A naive `line.split(",")` corrupts any Persian title containing a comma, which
 * is exactly the data this file round-trips, so the quoting written by
 * `toBackupCsv` has to be understood on the way back in.
 */
function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"'
          index += 1
        } else quoted = false
      } else current += char
      continue
    }
    if (char === '"') quoted = true
    else if (char === ",") {
      cells.push(current)
      current = ""
    } else current += char
  }
  cells.push(current)
  return cells.map((value) => value.trim())
}

/** Joins physical lines back together when a quoted cell contains a newline. */
function csvRecords(source: string): string[] {
  const records: string[] = []
  let current = ""
  let quotes = 0
  for (const line of source.split(/\r?\n/)) {
    current = current ? `${current}\n${line}` : line
    quotes += (line.match(/"/g) ?? []).length
    if (quotes % 2 === 0) {
      if (current.trim()) records.push(current)
      current = ""
    }
  }
  if (current.trim()) records.push(current)
  return records
}

function parseCsvRecords(source: string): Record<string, unknown>[] {
  const records = csvRecords(source)
  if (!records.length) return []
  const header = splitCsvLine(records[0]).map((name) => name.replace(/^\uFEFF/, ""))
  const known = header.filter((name) => (BACKUP_COLUMNS as readonly string[]).includes(name))
  if (!known.includes("tld")) throw new Error("سرستون فایل CSV باید شامل ستون tld باشد.")
  return records.slice(1).map((record) => {
    const cells = splitCsvLine(record)
    const entry: Record<string, unknown> = {}
    header.forEach((name, index) => {
      if ((BACKUP_COLUMNS as readonly string[]).includes(name)) entry[name] = cells[index] ?? ""
    })
    return entry
  })
}

/**
 * Reads either format an admin might paste or upload.
 *
 * The export offers JSON and CSV, and the restore box is a plain textarea, so the
 * format is detected from the content rather than trusting a file extension.
 */
export function parseBackup(source: string): BackupRow[] {
  const text = source.replace(/^\uFEFF/, "").trim()
  if (!text) throw new Error("فایل خالی است.")

  let records: unknown[]
  if (text.startsWith("{") || text.startsWith("[")) {
    const parsed: unknown = JSON.parse(text)
    const list = Array.isArray(parsed) ? parsed : (parsed as { tlds?: unknown }).tlds
    if (!Array.isArray(list)) throw new Error("ساختار JSON معتبر نیست: کلید tlds پیدا نشد.")
    records = list
  } else {
    records = parseCsvRecords(text)
  }
  if (!records.length) throw new Error("فایل داده‌ای ندارد.")

  const rows: BackupRow[] = []
  const seen = new Set<string>()
  records.forEach((record, index) => {
    const result = backupRowSchema.safeParse(record)
    if (!result.success) {
      throw new Error(`ردیف ${index + 1}: ${result.error.issues[0]?.message ?? "داده معتبر نیست."}`)
    }
    if (seen.has(result.data.tld)) throw new Error(`پسوند تکراری در فایل: ${result.data.tld}`)
    seen.add(result.data.tld)
    rows.push(result.data)
  })
  return rows
}
