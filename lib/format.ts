const faNumber = new Intl.NumberFormat('fa-IR')

export function toToman(amount: number | string | bigint): number {
  // amounts are stored in Toman already (BigInt-safe via string)
  return typeof amount === 'number' ? amount : Number(amount)
}

export function formatToman(amount: number | string | bigint): string {
  return faNumber.format(toToman(amount))
}

export function formatNumber(n: number | string | bigint): string {
  return faNumber.format(typeof n === 'number' ? n : Number(n))
}

/**
 * Format a money amount stored as integer minor units for its currency.
 * IRT has 0 decimals (whole Toman); USD/USDT have 2 (minor units = cents).
 */
export function formatMoney(
  amount: number | string | bigint,
  decimals = 0,
): string {
  const value = typeof amount === 'number' ? amount : Number(amount)
  const major = decimals > 0 ? value / 10 ** decimals : value
  return new Intl.NumberFormat('fa-IR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(major)
}

const rtf = new Intl.RelativeTimeFormat('fa', { numeric: 'auto' })

export function formatRelative(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = d.getTime() - Date.now()
  const abs = Math.abs(diff)
  const min = 60 * 1000
  const hour = 60 * min
  const day = 24 * hour
  if (abs < hour) return rtf.format(Math.round(diff / min), 'minute')
  if (abs < day) return rtf.format(Math.round(diff / hour), 'hour')
  return rtf.format(Math.round(diff / day), 'day')
}

/** All human-facing timestamps are shown in Tehran local time. */
export const TEHRAN_TZ = 'Asia/Tehran'

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: TEHRAN_TZ,
  }).format(d)
}

/** Format a date+time in Tehran time for an arbitrary locale (used by the bot). */
export function formatDateTimeLocale(
  date: string | Date,
  locale: string,
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: TEHRAN_TZ,
  }).format(d)
}

/**
 * Offset (ms) of a timezone at a given instant, i.e. (wall clock in tz) - (UTC).
 * Iran no longer observes DST, so Asia/Tehran is a fixed +03:30, but this stays
 * correct for any zone.
 */
function tzOffsetMs(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const map: Record<string, number> = {}
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== 'literal') map[p.type] = Number(p.value)
  }
  const asUTC = Date.UTC(map.year, map.month - 1, map.day, map.hour, map.minute, map.second)
  return asUTC - date.getTime()
}

/**
 * Interpret a `datetime-local` wall-clock string ("YYYY-MM-DDTHH:mm") as Tehran
 * local time and return the corresponding UTC Date. Independent of the server or
 * browser timezone, so admins always enter/see Tehran time.
 */
export function tehranInputToUtc(local: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local)
  if (!m) return new Date(local)
  const [, y, mo, d, h, mi] = m.map(Number)
  const guess = Date.UTC(y, mo - 1, d, h, mi, 0)
  const offset = tzOffsetMs(TEHRAN_TZ, new Date(guess))
  return new Date(guess - offset)
}

/** Same as tehranInputToUtc but returns an ISO string (for API payloads). */
export function tehranInputToUtcISO(local: string): string {
  return tehranInputToUtc(local).toISOString()
}

/**
 * Convert a stored UTC ISO timestamp into the "YYYY-MM-DDTHH:mm" wall-clock
 * value a `datetime-local` input expects, expressed in Tehran time.
 */
export function utcToTehranInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: TEHRAN_TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const map: Record<string, string> = {}
  for (const p of dtf.formatToParts(d)) {
    if (p.type !== 'literal') map[p.type] = p.value
  }
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`
}

/** Returns ms remaining; clamps at 0 */
export function msUntil(date: string | Date): number {
  const d = typeof date === 'string' ? new Date(date) : date
  return Math.max(0, d.getTime() - Date.now())
}

export function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const secs = totalSec % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  const parts = [pad(hours), pad(mins), pad(secs)].join(':')
  if (days > 0) return `${days} روز ${parts}`
  return parts
}
