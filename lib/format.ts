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
