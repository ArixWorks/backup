import "server-only"
import { prisma } from "@/lib/db"
import { sendEmail } from "@/lib/email/send"
import { botConfigured, sendMessage } from "@/lib/telegram/api"
import { DEFAULT_ADMIN_TELEGRAM_IDS } from "@/lib/telegram/user"
import { emitOps } from "@/lib/core/events"

/**
 * Multi-channel alert dispatch: Telegram (primary owner private chat only),
 * Email (OPS_ALERT_EMAILS), and the dashboard realtime stream. Each channel is best-effort and isolated
 * so one failing transport never blocks the others.
 */

export type AlertChannel = "telegram" | "email" | "dashboard"

export interface DispatchPayload {
  title: string
  message: string
  severity: "INFO" | "WARNING" | "CRITICAL"
  status: "FIRING" | "RESOLVED"
  metric?: string | null
  value?: number | null
  channels: AlertChannel[]
  eventId?: string
}

const SEVERITY_EMOJI: Record<DispatchPayload["severity"], string> = {
  INFO: "🔵",
  WARNING: "🟠",
  CRITICAL: "🔴",
}

function formatTelegram(p: DispatchPayload): string {
  const head = p.status === "RESOLVED" ? "✅ <b>هشدار برطرف شد</b>" : `${SEVERITY_EMOJI[p.severity]} <b>هشدار سیستم</b>`
  const lines = [
    head,
    "",
    `📌 <b>${escapeHtml(p.title)}</b>`,
    escapeHtml(p.message),
  ]
  if (p.metric) {
    lines.push(`📊 معیار: <code>${escapeHtml(p.metric)}</code>${p.value != null ? ` = <b>${formatNum(p.value)}</b>` : ""}`)
  }
  lines.push(`🕐 ${new Date().toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })}`)
  return lines.join("\n")
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

async function dispatchTelegram(p: DispatchPayload) {
  if (!botConfigured()) return
  try {
    const ownerTelegramId = DEFAULT_ADMIN_TELEGRAM_IDS[0]
    const owner = await prisma.user.findUnique({
      where: { telegramId: ownerTelegramId },
      select: { telegramId: true },
    })

    // System alerts are private owner messages only. Never trust
    // telegramChatId here because Telegram group updates can overwrite it.
    const privateChatId = owner?.telegramId ?? ownerTelegramId
    if (!/^\d+$/.test(privateChatId) || Number(privateChatId) <= 0) return

    await sendMessage(privateChatId, formatTelegram(p))
  } catch (e) {
    console.log("[v0] dispatchTelegram error:", (e as Error).message)
  }
}

async function dispatchEmail(p: DispatchPayload) {
  const raw = process.env.OPS_ALERT_EMAILS
  if (!raw) return
  const recipients = raw.split(",").map((s) => s.trim()).filter(Boolean)
  if (recipients.length === 0) return
  const subject =
    p.status === "RESOLVED"
      ? `[برطرف شد] ${p.title}`
      : `[${p.severity}] هشدار سیستم: ${p.title}`
  const html = `
    <h2 style="color:${p.severity === "CRITICAL" ? "#dc2626" : p.severity === "WARNING" ? "#d97706" : "#2563eb"}">
      ${SEVERITY_EMOJI[p.severity]} ${escapeHtml(p.title)}
    </h2>
    <p>${escapeHtml(p.message)}</p>
    ${p.metric ? `<p><strong>معیار:</strong> ${escapeHtml(p.metric)}${p.value != null ? ` = ${formatNum(p.value)}` : ""}</p>` : ""}
    <p style="color:#888;font-size:12px">${new Date().toLocaleString("fa-IR", { timeZone: "Asia/Tehran" })}</p>
  `
  await Promise.all(
    recipients.map((to) => sendEmail({ to, subject, html }).catch(() => ({ sent: false }))),
  )
}

async function dispatchDashboard(p: DispatchPayload) {
  await emitOps({
    kind: p.status === "RESOLVED" ? "alert_resolved" : "alert",
    payload: {
      id: p.eventId,
      title: p.title,
      message: p.message,
      severity: p.severity,
      status: p.status,
      metric: p.metric ?? null,
      value: p.value ?? null,
    },
  })
}

export async function dispatchAlert(p: DispatchPayload): Promise<void> {
  const channels = new Set(p.channels)
  const jobs: Promise<unknown>[] = []
  // Dashboard always receives the event so the live feed stays complete.
  jobs.push(dispatchDashboard(p))
  if (channels.has("telegram")) jobs.push(dispatchTelegram(p))
  if (channels.has("email")) jobs.push(dispatchEmail(p))
  await Promise.allSettled(jobs)
}
