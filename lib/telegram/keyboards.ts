import type { BotConfig, RequiredChannel } from "./config"
import { inlineKeyboard, type InlineKeyboard, type InlineButton } from "./api"
import { btnLabel } from "./i18n"
import { DEFAULT_LOCALE, type Locale, LOCALE_NAMES, LOCALE_FLAGS, LOCALES } from "@/lib/i18n/locales"

export function appUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "")
  return base
}

/** Matches a leading emoji (incl. ZWJ sequences / variation selector) + space. */
const LEADING_EMOJI = /^(?:\p{Extended_Pictographic}(?:\u200d\p{Extended_Pictographic})*\uFE0F?\s*)+/u

/**
 * Build a button for `key`, applying the configured color (`style`) and, when
 * set, a custom animated emoji as the button icon (`icon_custom_emoji_id`).
 * The label is localized via btnLabel(). When a custom icon is used we strip
 * the static leading emoji from the label so it isn't shown twice.
 */
export function styledButton(
  cfg: BotConfig,
  key: string,
  base: Omit<InlineButton, "text" | "style" | "icon_custom_emoji_id">,
  locale: Locale = DEFAULT_LOCALE,
): InlineButton {
  const label = btnLabel(cfg, locale, key)
  const btn: InlineButton = { ...base, text: label }

  const style = cfg.buttonStyles?.[key]
  if (style) btn.style = style

  const emojiId = cfg.buttonEmoji?.[key] || cfg.buttonEmojiAll
  if (emojiId) {
    btn.icon_custom_emoji_id = emojiId
    const stripped = label.replace(LEADING_EMOJI, "").trim()
    if (stripped) btn.text = stripped
  }
  return btn
}

/** Main menu inline keyboard, respecting feature toggles. */
export function mainMenu(cfg: BotConfig, locale: Locale = DEFAULT_LOCALE) {
  const rows: InlineKeyboard = []
  const url = appUrl()

  if (cfg.features.miniApp && url) {
    rows.push([styledButton(cfg, "openApp", { web_app: { url } }, locale)])
  }
  rows.push([
    styledButton(cfg, "auctions", { callback_data: "menu:auctions" }, locale),
    styledButton(cfg, "flash", { callback_data: "menu:flash" }, locale),
  ])
  const walletRow: InlineButton[] = []
  if (cfg.features.walletInChat)
    walletRow.push(styledButton(cfg, "wallet", { callback_data: "menu:wallet" }, locale))
  walletRow.push(styledButton(cfg, "orders", { callback_data: "menu:orders" }, locale))
  rows.push(walletRow)
  rows.push([
    styledButton(cfg, "watchlist", { callback_data: "menu:watchlist" }, locale),
    styledButton(cfg, "help", { callback_data: "menu:help" }, locale),
  ])
  rows.push([styledButton(cfg, "invite", { callback_data: "menu:invite" }, locale)])
  rows.push([styledButton(cfg, "language", { callback_data: "menu:language" }, locale)])
  return inlineKeyboard(rows)
}

/**
 * Build the in-bot referral deep link: tapping it opens the bot with the
 * inviter's code as the /start payload (`ref_<CODE>`). Falls back to "" when the
 * bot username hasn't been resolved yet.
 */
export function referralDeepLink(cfg: BotConfig, code: string): string {
  return cfg.botUsername ? `https://t.me/${cfg.botUsername}?start=ref_${code}` : ""
}

/**
 * Referral screen keyboard: a native Telegram "share" button (forwards the
 * invite link into any chat) plus a Back button. When the bot username isn't
 * resolved yet we only show Back.
 */
export function referralKeyboard(
  cfg: BotConfig,
  code: string,
  shareText: string,
  locale: Locale = DEFAULT_LOCALE,
) {
  const rows: InlineKeyboard = []
  const link = referralDeepLink(cfg, code)
  if (link) {
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`
    rows.push([styledButton(cfg, "shareInvite", { url: shareUrl }, locale)])
  }
  rows.push([styledButton(cfg, "back", { callback_data: "menu:home" }, locale)])
  return inlineKeyboard(rows)
}

export function backButton(cfg: BotConfig, locale: Locale = DEFAULT_LOCALE) {
  return inlineKeyboard([[styledButton(cfg, "back", { callback_data: "menu:home" }, locale)]])
}

export function walletMenu(cfg: BotConfig, locale: Locale = DEFAULT_LOCALE) {
  const rows: InlineKeyboard = []
  const actionRow: InlineButton[] = []
  if (cfg.features.deposits)
    actionRow.push(styledButton(cfg, "deposit", { callback_data: "wallet:deposit" }, locale))
  if (cfg.features.withdrawals)
    actionRow.push(styledButton(cfg, "withdraw", { callback_data: "wallet:withdraw" }, locale))
  if (actionRow.length) rows.push(actionRow)
  rows.push([
    styledButton(cfg, "refresh", { callback_data: "menu:wallet" }, locale),
    styledButton(cfg, "back", { callback_data: "menu:home" }, locale),
  ])
  return inlineKeyboard(rows)
}

/**
 * Product card keyboard: "Buy now" starts the quantity flow; "Open app" jumps
 * to the flash page. (Deep callback carries product id.)
 */
export function productCardKeyboard(cfg: BotConfig, productId: string, locale: Locale = DEFAULT_LOCALE) {
  const url = appUrl()
  const rows: InlineKeyboard = [[styledButton(cfg, "buyNow", { callback_data: `buy:${productId}` }, locale)]]
  if (url) rows.push([styledButton(cfg, "openApp", { web_app: { url: `${url}/flash` } }, locale)])
  return inlineKeyboard(rows)
}

/** Payment-method keyboard shown after the quantity is chosen. */
export function paymentKeyboard(
  cfg: BotConfig,
  productId: string,
  qty: number,
  locale: Locale = DEFAULT_LOCALE,
) {
  const rows: InlineKeyboard = []
  const g = cfg.gateways
  // Wallet is the only active gateway; the rest are "coming soon".
  rows.push([
    styledButton(
      cfg,
      "payWallet",
      { callback_data: g.wallet ? `pay:wallet:${productId}:${qty}` : `pay:soon:${productId}:${qty}` },
      locale,
    ),
  ])
  rows.push([styledButton(cfg, "payBinance", { callback_data: `pay:soon:${productId}:${qty}` }, locale)])
  rows.push([
    styledButton(cfg, "payUsdt", { callback_data: `pay:soon:${productId}:${qty}` }, locale),
    styledButton(cfg, "payCrypto", { callback_data: `pay:soon:${productId}:${qty}` }, locale),
  ])
  rows.push([styledButton(cfg, "cancel", { callback_data: "menu:home" }, locale)])
  return inlineKeyboard(rows)
}

/**
 * Language picker keyboard. During onboarding (`withBack=false`) we omit the
 * "Back" button so the very first interaction is a forced language choice.
 */
export function languageKeyboard(
  cfg: BotConfig,
  locale: Locale = DEFAULT_LOCALE,
  withBack = true,
) {
  const rows: InlineKeyboard = LOCALES.map((l) => [
    { text: `${LOCALE_FLAGS[l]} ${LOCALE_NAMES[l]}`, callback_data: `lang:${l}` } as InlineButton,
  ])
  if (withBack) rows.push([styledButton(cfg, "back", { callback_data: "menu:home" }, locale)])
  return inlineKeyboard(rows)
}

/** Resolve a join URL for a required channel (derives t.me/<user> for @ids). */
function channelJoinUrl(ch: RequiredChannel): string | undefined {
  const url = (ch.url || "").trim()
  if (/^https?:\/\//i.test(url)) return url
  const id = (ch.id || "").trim()
  if (id.startsWith("@")) return `https://t.me/${id.slice(1)}`
  return undefined
}

/**
 * Forced-join keyboard: one "Join" button per channel the user still needs to
 * join, followed by a "Verify membership" button that re-checks access.
 * Uses the animated megaphone icon (joinChannel) on each channel button.
 */
export function forcedJoinKeyboard(
  cfg: BotConfig,
  locale: Locale = DEFAULT_LOCALE,
  channels: RequiredChannel[] = [],
) {
  const megaphone = cfg.emoji.megaphone || "📣"
  const rows: InlineKeyboard = channels.map((ch) => {
    const url = channelJoinUrl(ch)
    const text = `${megaphone} ${ch.title?.trim() || ch.id}`
    const btn: InlineButton = url
      ? { text, url, icon_custom_emoji_id: cfg.buttonEmoji?.joinChannel || cfg.buttonEmojiAll || undefined }
      : { text, callback_data: "join:check" }
    if (cfg.buttonStyles?.joinChannel) btn.style = cfg.buttonStyles.joinChannel
    return [btn]
  })
  rows.push([styledButton(cfg, "checkJoin", { callback_data: "join:check" }, locale)])
  return inlineKeyboard(rows)
}

/** Open-app button pointing at an arbitrary path (defaults to the home url). */
export function openAppKeyboard(cfg: BotConfig, path = "", locale: Locale = DEFAULT_LOCALE) {
  const url = appUrl()
  if (!url) return undefined
  return inlineKeyboard([[styledButton(cfg, "openApp", { web_app: { url: `${url}${path}` } }, locale)]])
}

/** Open-app button for an auction notification. */
export function auctionButton(cfg: BotConfig, auctionId: string, locale: Locale = DEFAULT_LOCALE) {
  return openAppKeyboard(cfg, `/auctions/${auctionId}`, locale)
}
