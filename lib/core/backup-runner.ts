import "server-only"
import { createBackup } from "@/lib/core/backup"
import { sendDocument, sendMessage, botConfigured } from "@/lib/telegram/api"
import { getSetting, setSetting, toBool, toNumber, SETTING_KEYS } from "@/lib/core/settings"

/** Format bytes as a short human string for the backup caption. */
function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/** Civil date+hour in Asia/Tehran, independent of the server's own timezone. */
function tehranNow(): { date: string; hour: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  })
  const parts = fmt.formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
  // en-CA gives YYYY-MM-DD; hour can be "24" at midnight in some runtimes.
  const hour = Number(get("hour")) % 24
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour }
}

export type BackupRunResult = {
  ok: boolean
  filename?: string
  sizeBytes?: number
  totalRows?: number
  chatId?: string
  error?: string
}

/**
 * Create a backup and deliver it to a Telegram chat. Shared by the manual admin
 * button and the scheduled job. `chatIdOverride` lets the admin button target a
 * specific chat; otherwise the configured backup chat id is used.
 */
export async function runBackupNow(chatIdOverride?: string): Promise<BackupRunResult> {
  const chatId = (chatIdOverride || (await getSetting(SETTING_KEYS.backupChatId))).trim()
  if (!chatId) return { ok: false, error: "شناسه چت برای ارسال پشتیبان تنظیم نشده است" }
  if (!botConfigured()) return { ok: false, error: "توکن ربات تلگرام تنظیم نشده است" }

  const backup = await createBackup()
  const tables = Object.entries(backup.tables)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([t, n]) => `• ${t}: ${n.toLocaleString("fa-IR")}`)
    .join("\n")

  const caption =
    `🗄 <b>پشتیبان دیتابیس SubIO</b>\n` +
    `📅 ${new Date(backup.createdAt).toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })}\n` +
    `📦 حجم: ${humanSize(backup.sizeBytes)}\n` +
    `🧾 مجموع رکوردها: ${backup.totalRows.toLocaleString("fa-IR")}\n\n` +
    `${tables}\n\n` +
    `برای بازیابی، این فایل را در پنل ادمین → پشتیبان‌گیری بارگذاری کنید.`

  await sendDocument(chatId, backup.buffer, backup.filename, caption)
  return {
    ok: true,
    filename: backup.filename,
    sizeBytes: backup.sizeBytes,
    totalRows: backup.totalRows,
    chatId,
  }
}

/**
 * Cron-driven daily gate. Called every minute by the scheduler tick; performs a
 * backup AT MOST once per Tehran-local day, when the local hour reaches the
 * configured hour (default 00:00). Best-effort: failures notify the admin chat
 * but never throw into the tick.
 */
export async function maybeRunDailyBackup(): Promise<{ ran: boolean; reason?: string }> {
  if (!toBool(await getSetting(SETTING_KEYS.backupEnabled))) return { ran: false, reason: "disabled" }

  const { date, hour } = tehranNow()
  const targetHour = Math.max(0, Math.min(23, toNumber(await getSetting(SETTING_KEYS.backupHour), 0)))
  if (hour < targetHour) return { ran: false, reason: "before-hour" }

  const lastRun = await getSetting(SETTING_KEYS.backupLastRunDate)
  if (lastRun === date) return { ran: false, reason: "already-today" }

  // Claim today's slot BEFORE running so overlapping ticks don't double-fire.
  await setSetting(SETTING_KEYS.backupLastRunDate, date)
  try {
    const res = await runBackupNow()
    if (!res.ok && res.chatId) {
      await sendMessage(res.chatId, `⚠️ پشتیبان‌گیری خودکار ناموفق بود: ${res.error}`).catch(() => {})
    }
    return { ran: res.ok, reason: res.ok ? undefined : res.error }
  } catch (err) {
    console.log("[v0] scheduled backup failed:", (err as Error).message)
    const chatId = await getSetting(SETTING_KEYS.backupChatId)
    if (chatId) {
      await sendMessage(chatId, `⚠️ پشتیبان‌گیری خودکار با خطا مواجه شد: ${(err as Error).message}`).catch(() => {})
    }
    return { ran: false, reason: (err as Error).message }
  }
}
