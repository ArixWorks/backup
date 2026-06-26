import "server-only"
import type { ButtonStyle } from "./config"

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const API = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : null

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

async function call<T = any>(method: string, body: Record<string, unknown>): Promise<T> {
  if (!API) throw new Error("TELEGRAM_BOT_TOKEN is not set")
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!data.ok) {
    console.log("[v0] Telegram API error:", method, JSON.stringify(data))
    throw new Error(data.description || "Telegram API error")
  }
  return data.result as T
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
    allowed_updates: ["message", "callback_query"],
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
