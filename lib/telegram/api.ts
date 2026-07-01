import "server-only"
import type { ButtonStyle } from "./config"
import { CircuitBreaker, withRetry, withTimeout, TimeoutError } from "@/lib/core/resilience"

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const API = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : null

/** Per-request timeout for a single Telegram API call. */
const TG_TIMEOUT_MS = 8_000
/**
 * Circuit breaker shared across all Telegram calls: if the API is down/slow,
 * trip after repeated failures and fail fast for a short cool-down instead of
 * making every request wait on the timeout.
 */
const tgBreaker = new CircuitBreaker("telegram", { failureThreshold: 8, resetTimeoutMs: 20_000 })

/** Telegram "Too Many Requests" error carrying the server-advised wait (sec). */
class TelegramRetryAfter extends Error {
  constructor(public retryAfter: number) {
    super(`Telegram rate limited; retry after ${retryAfter}s`)
    this.name = "TelegramRetryAfter"
  }
}

export type InlineButton = {
  text: string
  url?: string
  callback_data?: string
  web_app?: { url: string }
  /** Bot API 9.4 button color. */
  style?: ButtonStyle
  /** Bot API 9.4 animated icon on the button. */
  icon_custom_emoji_id?: string
}
export type InlineKeyboard = InlineButton[][]
export type ReplyKeyboardButton = {
  text: string
  web_app?: { url: string }
  style?: ButtonStyle
  icon_custom_emoji_id?: string
}

type SendOpts = {
  replyMarkup?: object
  disablePreview?: boolean
  /** Defaults to HTML so messages can mix <b> and <tg-emoji> premium emoji. */
  parseMode?: "Markdown" | "MarkdownV2" | "HTML"
}

export function botConfigured(): boolean {
  return Boolean(TOKEN)
}

/** A single Telegram HTTP attempt, bounded by a timeout + abort signal. */
async function callOnce<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await withTimeout(
    TG_TIMEOUT_MS,
    (signal) =>
      fetch(`${API}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal,
      }),
    `telegram.${method}`,
  )
  const data = await res.json().catch(() => ({ ok: false, description: "Invalid JSON from Telegram" }))
  if (!data.ok) {
    // Honor Telegram's flood-control hint so retries back off the right amount.
    const retryAfter = data.parameters?.retry_after
    if (res.status === 429 && typeof retryAfter === "number") {
      throw new TelegramRetryAfter(retryAfter)
    }
    // 5xx are transient and worth retrying; 4xx (bad request) are not.
    const err = new Error(data.description || "Telegram API error") as Error & { status?: number }
    err.status = res.status
    throw err
  }
  return data.result as T
}

/**
 * Resilient Telegram API call: per-attempt timeout (no hung serverless
 * invocations on network latency), exponential-backoff retry for transient
 * failures (timeouts, 5xx, 429 honoring `retry_after`), and a shared circuit
 * breaker so a sustained outage fails fast instead of stalling every caller.
 */
async function call<T = any>(method: string, body: Record<string, unknown>): Promise<T> {
  if (!API) throw new Error("TELEGRAM_BOT_TOKEN is not set")
  return tgBreaker.execute(() =>
    withRetry(() => callOnce<T>(method, body), {
      attempts: 3,
      baseDelayMs: 300,
      maxDelayMs: 5_000,
      // Retry timeouts, rate limits, and 5xx; never retry a 4xx client error.
      retryable: (err) =>
        err instanceof TimeoutError ||
        err instanceof TelegramRetryAfter ||
        ((err as { status?: number })?.status ?? 0) >= 500,
      // When Telegram tells us how long to wait, respect it precisely.
      delayFor: (err) =>
        err instanceof TelegramRetryAfter ? err.retryAfter * 1000 : undefined,
      onRetry: (err, attempt, delay) =>
        console.log(`[v0] Telegram ${method} retry ${attempt} in ${delay}ms:`, (err as Error).message),
    }),
  )
}

export async function sendMessage(chatId: string | number, text: string, opts: SendOpts = {}) {
  return call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: opts.parseMode ?? "HTML",
    disable_web_page_preview: opts.disablePreview ?? true,
    reply_markup: opts.replyMarkup,
  })
}

export async function sendPhoto(
  chatId: string | number,
  photo: string,
  caption: string,
  opts: SendOpts = {},
) {
  return call("sendPhoto", {
    chat_id: chatId,
    photo,
    caption,
    parse_mode: opts.parseMode ?? "HTML",
    reply_markup: opts.replyMarkup,
  })
}

/**
 * Upload a file to a chat (multipart/form-data — Telegram doesn't accept JSON
 * for file uploads, so this bypasses the JSON `call()` helper). Used to deliver
 * database backups to the admin. Bot upload limit is 50MB; gzipped JSON
 * backups stay far below that. Bounded by a longer timeout since the upload
 * carries the whole file.
 */
export async function sendDocument(
  chatId: string | number,
  file: Buffer | Uint8Array,
  filename: string,
  caption?: string,
): Promise<unknown> {
  if (!API) throw new Error("TELEGRAM_BOT_TOKEN is not set")
  const form = new FormData()
  form.append("chat_id", String(chatId))
  if (caption) {
    form.append("caption", caption)
    form.append("parse_mode", "HTML")
  }
  const bytes = new Uint8Array(file)
  form.append("document", new Blob([bytes], { type: "application/gzip" }), filename)

  const res = await withTimeout(
    60_000,
    (signal) => fetch(`${API}/sendDocument`, { method: "POST", body: form, signal }),
    "telegram.sendDocument",
  )
  const data = await res.json().catch(() => ({ ok: false, description: "Invalid JSON from Telegram" }))
  if (!data.ok) throw new Error(data.description || "Telegram sendDocument failed")
  return data.result
}

export async function editMessageText(
  chatId: string | number,
  messageId: number,
  text: string,
  opts: SendOpts = {},
) {
  return call("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: opts.parseMode ?? "HTML",
    disable_web_page_preview: opts.disablePreview ?? true,
    reply_markup: opts.replyMarkup,
  }).catch((e) => {
    // "message is not modified" is harmless.
    if (!String(e.message).includes("not modified")) throw e
  })
}

export async function answerCallbackQuery(id: string, text?: string, showAlert = false) {
  return call("answerCallbackQuery", { callback_query_id: id, text, show_alert: showAlert })
}

/**
 * Create a Telegram Stars invoice link (currency XTR). `prices` amounts are in
 * the smallest currency unit — for Stars that is the whole star count. Returns
 * an invoice URL that a Mini App opens via `WebApp.openInvoice(url)`.
 */
export async function createInvoiceLink(params: {
  title: string
  description: string
  payload: string
  stars: number
}): Promise<string> {
  return call<string>("createInvoiceLink", {
    title: params.title,
    description: params.description,
    payload: params.payload,
    currency: "XTR",
    prices: [{ label: params.title, amount: params.stars }],
  })
}

/** Send a Stars invoice directly to a chat (bot flow). Returns the message. */
export async function sendInvoice(params: {
  chatId: string | number
  title: string
  description: string
  payload: string
  stars: number
}) {
  return call("sendInvoice", {
    chat_id: params.chatId,
    title: params.title,
    description: params.description,
    payload: params.payload,
    currency: "XTR",
    prices: [{ label: params.title, amount: params.stars }],
  })
}

/** Approve/decline a pre_checkout_query. Must be answered within 10 seconds. */
export async function answerPreCheckoutQuery(id: string, ok: boolean, errorMessage?: string) {
  return call("answerPreCheckoutQuery", {
    pre_checkout_query_id: id,
    ok,
    error_message: ok ? undefined : errorMessage,
  })
}

export type ChatMemberStatus =
  | "creator"
  | "administrator"
  | "member"
  | "restricted"
  | "left"
  | "kicked"

export type ChatMember = { status: ChatMemberStatus; is_member?: boolean }

/**
 * Look up a user's membership in a chat/channel. Used for forced-join checks.
 * The bot must be a member (admin) of the target channel for this to succeed;
 * otherwise Telegram returns an error which callers handle gracefully.
 */
export async function getChatMember(chatId: string | number, userId: string | number) {
  return call<ChatMember>("getChatMember", { chat_id: chatId, user_id: userId })
}

export async function setWebhook(url: string, secret: string) {
  return call("setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message", "callback_query", "pre_checkout_query"],
    drop_pending_updates: true,
  })
}

export async function deleteWebhook() {
  return call("deleteWebhook", { drop_pending_updates: false })
}

export async function getWebhookInfo() {
  return call("getWebhookInfo", {})
}

export async function getMe() {
  return call("getMe", {})
}

export async function setMyCommands(commands: { command: string; description: string }[]) {
  return call("setMyCommands", { commands })
}

export async function setChatMenuButton(text: string, webAppUrl: string) {
  return call("setChatMenuButton", {
    menu_button: { type: "web_app", text, web_app: { url: webAppUrl } },
  })
}

export function inlineKeyboard(rows: InlineKeyboard) {
  return { inline_keyboard: rows }
}

export function replyKeyboard(rows: ReplyKeyboardButton[][]) {
  return { keyboard: rows, resize_keyboard: true, is_persistent: true }
}
