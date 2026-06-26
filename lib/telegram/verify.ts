import "server-only"
import crypto from "crypto"

const TOKEN = process.env.TELEGRAM_BOT_TOKEN

export type TelegramUser = {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  language_code?: string
  is_premium?: boolean
}

/**
 * Validate Telegram Mini App initData per the official algorithm:
 * secret = HMAC_SHA256("WebAppData", bot_token)
 * expected = HMAC_SHA256(secret, data_check_string)
 * Also enforces freshness via auth_date (default 24h).
 */
export function verifyInitData(
  initData: string,
  maxAgeSeconds = 86_400,
): { ok: boolean; user?: TelegramUser; reason?: string } {
  if (!TOKEN) return { ok: false, reason: "bot token not configured" }
  if (!initData) return { ok: false, reason: "empty initData" }

  const params = new URLSearchParams(initData)
  const hash = params.get("hash")
  if (!hash) return { ok: false, reason: "missing hash" }

  const authDate = Number(params.get("auth_date") || 0)
  if (!authDate) return { ok: false, reason: "missing auth_date" }
  const ageSec = Math.floor(Date.now() / 1000) - authDate
  if (ageSec > maxAgeSeconds) return { ok: false, reason: "initData expired" }

  const pairs: string[] = []
  params.forEach((value, key) => {
    if (key === "hash") return
    pairs.push(`${key}=${value}`)
  })
  pairs.sort()
  const dataCheckString = pairs.join("\n")

  const secret = crypto.createHmac("sha256", "WebAppData").update(TOKEN).digest()
  const expected = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex")

  if (
    expected.length !== hash.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hash))
  ) {
    return { ok: false, reason: "bad signature" }
  }

  let user: TelegramUser | undefined
  const rawUser = params.get("user")
  if (rawUser) {
    try {
      user = JSON.parse(rawUser) as TelegramUser
    } catch {
      return { ok: false, reason: "bad user json" }
    }
  }
  return { ok: true, user }
}

/**
 * Validate a Telegram *Login Widget* payload (the browser OAuth flow on the
 * login page). Fields arrive as a flat object; the check string is built from
 * all keys except `hash`:
 * secret = SHA256(bot_token); expected = HMAC_SHA256(secret, data_check_string)
 */
export function verifyLoginWidget(
  data: Record<string, unknown>,
  maxAgeSeconds = 86_400,
): { ok: boolean; user?: TelegramUser; reason?: string } {
  if (!TOKEN) return { ok: false, reason: "bot token not configured" }
  const hash = typeof data.hash === "string" ? data.hash : ""
  if (!hash) return { ok: false, reason: "missing hash" }

  const authDate = Number(data.auth_date || 0)
  if (!authDate) return { ok: false, reason: "missing auth_date" }
  if (Math.floor(Date.now() / 1000) - authDate > maxAgeSeconds) {
    return { ok: false, reason: "login expired" }
  }

  const dataCheckString = Object.keys(data)
    .filter((k) => k !== "hash" && data[k] !== undefined && data[k] !== null)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join("\n")

  const secret = crypto.createHash("sha256").update(TOKEN).digest()
  const expected = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex")

  if (
    expected.length !== hash.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hash))
  ) {
    return { ok: false, reason: "bad signature" }
  }

  const id = Number(data.id)
  if (!id) return { ok: false, reason: "missing id" }
  const user: TelegramUser = {
    id,
    first_name: typeof data.first_name === "string" ? data.first_name : undefined,
    last_name: typeof data.last_name === "string" ? data.last_name : undefined,
    username: typeof data.username === "string" ? data.username : undefined,
    photo_url: typeof data.photo_url === "string" ? data.photo_url : undefined,
  }
  return { ok: true, user }
}

/** Stable secret used to authenticate Telegram -> our webhook calls. */
export function webhookSecret(): string {
  return crypto
    .createHash("sha256")
    .update(`${TOKEN || "no-token"}:subio-webhook`)
    .digest("hex")
    .slice(0, 48)
}
