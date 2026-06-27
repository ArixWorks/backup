import { NextResponse } from "next/server"
import { handleUpdate, type TgUpdate } from "@/lib/telegram/handler"
import { webhookSecret } from "@/lib/telegram/verify"
import { cache } from "@/lib/redis"
import { checkRateLimit } from "@/lib/api/rate-limit"
import { withWebhook } from "@/lib/monitoring/instrument"
import { touchHeartbeat } from "@/lib/monitoring/heartbeat"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Telegram webhook receiver. Telegram includes our secret token in the
 * X-Telegram-Bot-Api-Secret-Token header (set during setWebhook). We verify it,
 * process the update, and always respond 200 quickly so Telegram does not retry.
 *
 * Two abuse protections layered on top of the secret check:
 *  - Replay protection: each update_id is processed at most once (Telegram can
 *    redeliver the same update on timeout/retry).
 *  - Per-sender flood limit: caps how many updates one Telegram user can drive
 *    through the bot in a short window.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-telegram-bot-api-secret-token")
  if (secret !== webhookSecret()) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  let update: TgUpdate
  try {
    update = (await req.json()) as TgUpdate
  } catch {
    return NextResponse.json({ ok: true })
  }

  // Replay protection — skip updates we've already handled. setIfAbsent is
  // atomic, so concurrent redeliveries can't both pass. Fails open on cache error.
  if (typeof update.update_id === "number") {
    const fresh = await cache
      .setIfAbsent(`tg:update:${update.update_id}`, "1", 3600)
      .catch(() => true)
    if (!fresh) return NextResponse.json({ ok: true })
  }

  // Per-sender flood limit. Always return 200 so Telegram doesn't retry; we
  // simply drop the over-limit update.
  const senderId = update.message?.from?.id ?? update.callback_query?.from?.id
  if (senderId != null) {
    const limit = await checkRateLimit({
      bucket: "tg:flood",
      identifier: String(senderId),
      limit: 30,
      windowSec: 10,
    })
    if (!limit.ok) return NextResponse.json({ ok: true })
  }

  // The bot is alive and receiving updates — record a liveness heartbeat the
  // Operations Center reads to detect an offline bot/webhook.
  void touchHeartbeat("bot")

  // Process; errors are isolated inside handleUpdate, but we still wrap so the
  // Operations Center records webhook duration/failures and captures errors.
  // Always respond 200 so Telegram does not retry.
  try {
    await withWebhook("telegram", () => handleUpdate(update))
  } catch {
    // already captured by withWebhook
  }
  return NextResponse.json({ ok: true })
}
