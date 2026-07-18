import "server-only"

import type { TelegramContent } from "@/lib/broadcast/core"
import { sendMessage, sendPhoto } from "@/lib/telegram/api"
import { renderCustomEmojiCodes } from "@/lib/telegram/format"

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const API = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : null

type TelegramMessage = { message_id: number }

async function call(method: string, payload: Record<string, unknown>): Promise<TelegramMessage | TelegramMessage[]> {
  if (!API) throw new Error("TELEGRAM_BOT_TOKEN is not set")
  const response = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  })
  const result = await response.json()
  if (!result.ok) throw new Error(result.description || `Telegram ${method} failed`)
  return result.result
}

function keyboard(content: TelegramContent) {
  if (!content.buttons.length) return undefined
  return {
    inline_keyboard: content.buttons.map((row) => row.map((button) => ({
      text: button.text,
      ...(button.openIn === "MINI_APP" ? { web_app: { url: button.url } } : { url: button.url }),
      ...(button.style === "default" ? {} : { style: button.style }),
    }))),
  }
}

export async function sendBroadcastPayload(chatId: string, content: TelegramContent): Promise<number[]> {
  const html = renderCustomEmojiCodes(content.html)
  const common = {
    chat_id: chatId,
    parse_mode: "HTML",
    disable_notification: content.silent,
    protect_content: content.protectContent,
    message_effect_id: content.effectId || undefined,
    reply_markup: keyboard(content),
  }
  if (content.media.length === 0) {
    const result = await sendMessage(chatId, html || " ", { replyMarkup: keyboard(content), disablePreview: content.disablePreview }) as TelegramMessage
    return [result.message_id]
  }
  if (content.media.length === 1 && content.media[0].type === "photo") {
    const caption = renderCustomEmojiCodes(content.media[0].caption || html)
    const result = await sendPhoto(chatId, content.media[0].url, caption, { replyMarkup: keyboard(content) }) as TelegramMessage
    return [result.message_id]
  }
  if (content.media.length > 1 && content.media.every((item) => item.type === "photo" || item.type === "video")) {
    const media = content.media.map((item, index) => ({
      type: item.type,
      media: item.url,
      caption: renderCustomEmojiCodes(index === 0 ? item.caption || html.slice(0, 1024) : item.caption || "") || undefined,
      parse_mode: "HTML",
    }))
    const result = await call("sendMediaGroup", { ...common, media }) as TelegramMessage[]
    if (content.buttons.length || html.length > 1024) {
      const followup = await sendMessage(chatId, html.length > 1024 ? html : "ادامه", { replyMarkup: keyboard(content), disablePreview: content.disablePreview }) as TelegramMessage
      return [...result.map((item) => item.message_id), followup.message_id]
    }
    return result.map((item) => item.message_id)
  }
  const ids: number[] = []
  for (let index = 0; index < content.media.length; index++) {
    const item = content.media[index]
    const method = item.type === "photo" ? "sendPhoto" : item.type === "video" ? "sendVideo" : item.type === "voice" ? "sendVoice" : item.type === "audio" ? "sendAudio" : "sendDocument"
    const result = await call(method, {
      ...common,
      [item.type === "photo" ? "photo" : item.type === "document" ? "document" : item.type]: item.url,
      caption: renderCustomEmojiCodes(item.caption || (index === 0 ? html.slice(0, 1024) : "")) || undefined,
      reply_markup: index === content.media.length - 1 ? keyboard(content) : undefined,
    }) as TelegramMessage
    ids.push(result.message_id)
  }
  if (html.length > 1024) {
    const followup = await sendMessage(chatId, html, { replyMarkup: keyboard(content), disablePreview: content.disablePreview }) as TelegramMessage
    ids.push(followup.message_id)
  }
  return ids
}
