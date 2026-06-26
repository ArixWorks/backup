import "server-only"
import { sendMessage, sendPhoto, inlineKeyboard } from "@/lib/telegram/api"
import { getBotConfig } from "@/lib/telegram/settings"

export type ChannelPostInput = {
  /** Optional product id to build a purchase deep link (t.me/<bot>?start=p_<id>). */
  productId?: string
  /** Pre-rendered HTML caption (built client-side from the composer fields). */
  caption: string
  /** Optional absolute image URL to attach as a photo. */
  imageUrl?: string
  /** Label for the buy button. */
  buttonLabel?: string
  /** Override the target channel (defaults to config.channelId). */
  channelId?: string
}

/**
 * Telegram needs an absolute, publicly reachable URL for photos. Resolve a
 * possibly-relative cover path (e.g. "/products/x.png") against the public base
 * URL; return undefined when no absolute URL can be built (text-only post).
 */
function absImage(src?: string): string | undefined {
  if (!src) return undefined
  if (/^https?:\/\//i.test(src)) return src
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "")
  if (!base) return undefined
  return `${base.replace(/\/$/, "")}/${src.replace(/^\//, "")}`
}

/** Build the t.me deep link that opens the bot on a given product card. */
export function buildBuyLink(botUsername: string, productId?: string): string | null {
  if (!botUsername) return null
  const u = botUsername.replace(/^@/, "")
  return productId ? `https://t.me/${u}?start=p_${productId}` : `https://t.me/${u}`
}

/**
 * Publish a marketing post to the configured Telegram channel. When a product
 * is selected we attach an inline "Buy now" button linking back to the bot via
 * a start deep link, exactly like the reference channel post.
 */
export async function sendChannelPost(input: ChannelPostInput): Promise<{ messageId: number }> {
  const config = await getBotConfig()
  const channelId = (input.channelId || config.channelId || "").trim()
  if (!channelId) {
    throw new Error("کانال تنظیم نشده است. ابتدا آیدی کانال را در تنظیمات ربات وارد کنید.")
  }

  const buyLink = buildBuyLink(config.botUsername, input.productId)
  const replyMarkup =
    buyLink && input.buttonLabel
      ? inlineKeyboard([[{ text: input.buttonLabel, url: buyLink }]])
      : undefined

  const image = absImage(input.imageUrl)
  const result = image
    ? await sendPhoto(channelId, image, input.caption, { replyMarkup })
    : await sendMessage(channelId, input.caption, { replyMarkup, disablePreview: false })

  return { messageId: (result as { message_id: number }).message_id }
}
