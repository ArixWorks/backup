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
export function mainMenu(cfg: BotConfig, locale: Locale = DEFAULT_LOCALE, unread = 0) {
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

  // Profile / Rewards row (feature-gated).
  const pr: InlineButton[] = []
  if (cfg.features.profile) pr.push(styledButton(cfg, "profile", { callback_data: "menu:profile" }, locale))
  if (cfg.features.rewards) pr.push(styledButton(cfg, "rewards", { callback_data: "menu:rewards" }, locale))
  if (pr.length) rows.push(pr)

  // Notifications (with unread badge) / Support row.
  const ns: InlineButton[] = []
  if (cfg.features.notificationsInbox) {
    const notif = styledButton(cfg, "notifications", { callback_data: "menu:notifications" }, locale)
    if (unread > 0) notif.text = `${notif.text} (${unread > 99 ? "99+" : unread})`
    ns.push(notif)
  }
  if (cfg.features.support) ns.push(styledButton(cfg, "support", { callback_data: "menu:support" }, locale))
  if (ns.length) rows.push(ns)

  rows.push([
    styledButton(cfg, "watchlist", { callback_data: "menu:watchlist" }, locale),
    styledButton(cfg, "help", { callback_data: "menu:help" }, locale),
  ])
  rows.push([styledButton(cfg, "invite", { callback_data: "menu:invite" }, locale)])
  rows.push([styledButton(cfg, "language", { callback_data: "menu:language" }, locale)])
  return inlineKeyboard(rows)
}

/** A single "Back to menu" row (used inside section keyboards). */
function backRow(cfg: BotConfig, locale: Locale): InlineButton[] {
  return [styledButton(cfg, "back", { callback_data: "menu:home" }, locale)]
}

export type ListItem = { id: string; label: string }

/**
 * Generic paginated list keyboard for the editable canvas: one button per item
 * (`open:<section>:<id>`), a prev/next pagination row (`page:<section>:<n>`),
 * and a Back-to-menu row. `section` is a short tag (flash|auc|notif).
 */
export function listKeyboard(
  cfg: BotConfig,
  section: string,
  items: ListItem[],
  page: number,
  hasNext: boolean,
  locale: Locale = DEFAULT_LOCALE,
) {
  const rows: InlineKeyboard = items.map((it) => [
    { text: it.label, callback_data: `open:${section}:${it.id}` } as InlineButton,
  ])
  const nav: InlineButton[] = []
  if (page > 0) nav.push(styledButton(cfg, "prev", { callback_data: `page:${section}:${page - 1}` }, locale))
  if (hasNext) nav.push(styledButton(cfg, "next", { callback_data: `page:${section}:${page + 1}` }, locale))
  if (nav.length) rows.push(nav)
  rows.push(backRow(cfg, locale))
  return inlineKeyboard(rows)
}

/** Flash-sale detail actions: buy (wallet or per-order), coupon, back-to-list. */
export function flashDetailKeyboard(
  cfg: BotConfig,
  productId: string,
  page: number,
  locale: Locale = DEFAULT_LOCALE,
) {
  const rows: InlineKeyboard = [
    [styledButton(cfg, "buyNow", { callback_data: `buy:${productId}` }, locale)],
  ]
  if (cfg.features.coupons)
    rows.push([styledButton(cfg, "applyCoupon", { callback_data: `coupon:${productId}` }, locale)])
  rows.push([styledButton(cfg, "backToList", { callback_data: `page:flash:${page}` }, locale)])
  return inlineKeyboard(rows)
}

/** Auction detail actions: place bid / buy now / watch toggle / back-to-list. */
export function auctionDetailKeyboard(
  cfg: BotConfig,
  auctionId: string,
  page: number,
  opts: { canBuyNow: boolean; watching: boolean; active: boolean },
  locale: Locale = DEFAULT_LOCALE,
) {
  const rows: InlineKeyboard = []
  if (opts.active) {
    const actionRow: InlineButton[] = [
      styledButton(cfg, "bid", { callback_data: `bid:${auctionId}:${page}` }, locale),
    ]
    if (opts.canBuyNow)
      actionRow.push(styledButton(cfg, "buyNowAuction", { callback_data: `abuy:${auctionId}:${page}` }, locale))
    rows.push(actionRow)
    rows.push([
      styledButton(
        cfg,
        opts.watching ? "unwatch" : "watch",
        { callback_data: `watch:${auctionId}:${page}` },
        locale,
      ),
    ])
  }
  rows.push([styledButton(cfg, "backToList", { callback_data: `page:auc:${page}` }, locale)])
  return inlineKeyboard(rows)
}

/** Deposit method chooser, gated by the enabled payment slots. */
export function depositMethodKeyboard(
  cfg: BotConfig,
  methods: ("CARD" | "TON" | "USDT" | "STARS")[],
  locale: Locale = DEFAULT_LOCALE,
) {
  const map: Record<string, string> = { CARD: "depCard", TON: "depTon", USDT: "depUsdt", STARS: "depStars" }
  const rows: InlineKeyboard = methods.map((m) => [
    styledButton(cfg, map[m], { callback_data: `dep:${m}` }, locale),
  ])
  rows.push(backRow(cfg, locale))
  return inlineKeyboard(rows)
}

/** Deposit instructions actions: mark paid, upload receipt, back to wallet. */
export function depositInstructionsKeyboard(
  cfg: BotConfig,
  depositId: string,
  locale: Locale = DEFAULT_LOCALE,
) {
  return inlineKeyboard([
    [styledButton(cfg, "iPaid", { callback_data: `deppaid:${depositId}` }, locale)],
    [styledButton(cfg, "uploadReceipt", { callback_data: `deprcpt:${depositId}` }, locale)],
    [styledButton(cfg, "wallet", { callback_data: "menu:wallet" }, locale)],
  ])
}

/**
 * Per-order payment chooser: pay from wallet balance, or top up via a method
 * (`opay:<method>:<productId>:<qty>`), method ∈ WALLET|CARD|TON|USDT|STARS.
 */
export function orderPayKeyboard(
  cfg: BotConfig,
  productId: string,
  qty: number,
  methods: ("CARD" | "TON" | "STARS")[],
  locale: Locale = DEFAULT_LOCALE,
) {
  const rows: InlineKeyboard = [
    [styledButton(cfg, "payWallet", { callback_data: `opay:WALLET:${productId}:${qty}` }, locale)],
  ]
  if (cfg.features.perOrderPay) {
    const map: Record<string, string> = { CARD: "depCard", TON: "depTon", STARS: "depStars" }
    for (const m of methods) {
      rows.push([styledButton(cfg, map[m], { callback_data: `opay:${m}:${productId}:${qty}` }, locale)])
    }
  }
  rows.push([styledButton(cfg, "cancel", { callback_data: "menu:home" }, locale)])
  return inlineKeyboard(rows)
}

/** Notifications inbox keyboard: one button per item + mark-all-read + nav. */
export function notificationsKeyboard(
  cfg: BotConfig,
  items: ListItem[],
  page: number,
  hasNext: boolean,
  hasUnread: boolean,
  locale: Locale = DEFAULT_LOCALE,
) {
  const rows: InlineKeyboard = items.map((it) => [
    { text: it.label, callback_data: `nopen:${it.id}` } as InlineButton,
  ])
  if (hasUnread) rows.push([styledButton(cfg, "markAllRead", { callback_data: "nallread" }, locale)])
  const nav: InlineButton[] = []
  if (page > 0) nav.push(styledButton(cfg, "prev", { callback_data: `page:notif:${page - 1}` }, locale))
  if (hasNext) nav.push(styledButton(cfg, "next", { callback_data: `page:notif:${page + 1}` }, locale))
  if (nav.length) rows.push(nav)
  rows.push(backRow(cfg, locale))
  return inlineKeyboard(rows)
}

/** Rewards keyboard: a Claim button per claimable mission + back. */
export function rewardsKeyboard(
  cfg: BotConfig,
  claimable: ListItem[],
  locale: Locale = DEFAULT_LOCALE,
) {
  const rows: InlineKeyboard = claimable.map((m) => [
    styledButton(cfg, "claim", { callback_data: `mclaim:${m.id}` }, locale),
  ])
  // Give each Claim button a distinct visible label so users know what they claim.
  claimable.forEach((m, i) => {
    if (rows[i]?.[0]) rows[i][0].text = m.label
  })
  rows.push(backRow(cfg, locale))
  return inlineKeyboard(rows)
}

/** Support keyboard: New ticket + one button per existing ticket + back. */
export function supportKeyboard(
  cfg: BotConfig,
  tickets: ListItem[],
  locale: Locale = DEFAULT_LOCALE,
) {
  const rows: InlineKeyboard = [[styledButton(cfg, "newTicket", { callback_data: "tnew" }, locale)]]
  for (const tk of tickets) rows.push([{ text: tk.label, callback_data: `topen:${tk.id}` } as InlineButton])
  rows.push(backRow(cfg, locale))
  return inlineKeyboard(rows)
}

/** A single support-ticket thread's actions: reply / close / back to list. */
export function ticketThreadKeyboard(
  cfg: BotConfig,
  publicId: string,
  closed: boolean,
  locale: Locale = DEFAULT_LOCALE,
) {
  const rows: InlineKeyboard = []
  if (!closed) {
    rows.push([
      styledButton(cfg, "replyTicket", { callback_data: `treply:${publicId}` }, locale),
      styledButton(cfg, "closeTicket", { callback_data: `tclose:${publicId}` }, locale),
    ])
  }
  rows.push([styledButton(cfg, "support", { callback_data: "menu:support" }, locale)])
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
