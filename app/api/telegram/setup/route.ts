import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/session"
import {
  setWebhook,
  deleteWebhook,
  getWebhookInfo,
  getMe,
  setMyCommands,
  setChatMenuButton,
  botConfigured,
} from "@/lib/telegram/api"
import { webhookSecret } from "@/lib/telegram/verify"
import { appUrl } from "@/lib/telegram/keyboards"
import { getBotConfig, saveBotConfig } from "@/lib/telegram/settings"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** GET: report current bot + webhook status (admin only). */
export async function GET() {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ ok: false, error: "admin required" }, { status: 403 })
  }
  if (!botConfigured()) {
    return NextResponse.json({ ok: true, data: { configured: false } })
  }
  const [me, info] = await Promise.all([getMe().catch(() => null), getWebhookInfo().catch(() => null)])
  return NextResponse.json({
    ok: true,
    data: { configured: true, me, webhook: info, appUrl: appUrl() },
  })
}

/**
 * POST: (re)register the webhook, slash commands and the chat menu button.
 * action="install" sets everything; action="remove" deletes the webhook.
 */
export async function POST(req: Request) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ ok: false, error: "admin required" }, { status: 403 })
  }
  if (!botConfigured()) {
    return NextResponse.json(
      { ok: false, error: "TELEGRAM_BOT_TOKEN not set" },
      { status: 400 },
    )
  }

  const body = (await req.json().catch(() => ({}))) as { action?: string }
  const action = body.action ?? "install"

  if (action === "remove") {
    await deleteWebhook()
    return NextResponse.json({ ok: true, data: { removed: true } })
  }

  const base = appUrl()
  if (!base) {
    return NextResponse.json(
      { ok: false, error: "App URL is not available; deploy or set NEXT_PUBLIC_APP_URL" },
      { status: 400 },
    )
  }

  const cfg = await getBotConfig()
  const webhookUrl = `${base}/api/telegram/webhook`

  // Cache the bot username so purchase deep links (t.me/<bot>?start=…) work,
  // unless an admin has already set one manually.
  if (!cfg.botUsername) {
    const me = await getMe().catch(() => null)
    const username = (me as { username?: string } | null)?.username
    if (username) await saveBotConfig({ botUsername: username })
  }

  await setWebhook(webhookUrl, webhookSecret())
  await setMyCommands([
    { command: "start", description: "شروع و منوی اصلی" },
    { command: "menu", description: "منوی اصلی" },
    { command: "wallet", description: "کیف پول" },
    { command: "orders", description: "سفارش‌های من" },
    { command: "flash", description: "فروش فوری" },
    { command: "auctions", description: "مزایده‌ها" },
    { command: "watchlist", description: "لیست پیگیری" },
    { command: "app", description: "باز کردن اپ" },
    { command: "help", description: "راهنما" },
  ])
  if (cfg.features.miniApp) {
    // Use a short Latin label ("WebSite") for the chat menu button: long Persian
    // phrases render badly and overflow into the message field on some phones.
    await setChatMenuButton("WebSite", base).catch(() => {})
  }

  const info = await getWebhookInfo().catch(() => null)
  return NextResponse.json({ ok: true, data: { webhookUrl, webhook: info } })
}
