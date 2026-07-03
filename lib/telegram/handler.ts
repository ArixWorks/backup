import "server-only"
import type { User } from "@prisma/client"
import { prisma } from "@/lib/db"
import { getBotConfig } from "./settings"
import { render, esc, emo } from "./format"
import { t } from "./i18n"
import {
  sendMessage,
  sendPhoto,
  editMessageText,
  editMessageCaption,
  editMessageMedia,
  answerCallbackQuery,
  inlineKeyboard,
  answerPreCheckoutQuery,
  sendInvoice,
  getFile,
  downloadTelegramFile,
  botConfigured,
} from "./api"
import {
  mainMenu,
  walletMenu,
  backButton,
  paymentKeyboard,
  languageKeyboard,
  forcedJoinKeyboard,
  auctionButton,
  openAppKeyboard,
  referralKeyboard,
  referralDeepLink,
  appUrl,
  listKeyboard,
  flashDetailKeyboard,
  auctionDetailKeyboard,
  depositMethodKeyboard,
  depositInstructionsKeyboard,
  orderPayKeyboard,
  notificationsKeyboard,
  rewardsKeyboard,
  supportKeyboard,
  ticketThreadKeyboard,
  type ListItem,
} from "./keyboards"
import { checkMemberships, clearMembershipCache, forcedJoinActive } from "./membership"
import { resolveTelegramUser, isAdminTelegram } from "./user"
import { getMaintenance } from "@/lib/core/settings"
import {
  setPending,
  getPending,
  clearPending,
  setCanvas,
  getCanvas,
  setOrderDraft,
  getOrderDraft,
  clearOrderDraft,
  type PendingAction,
  type BotPayMethod,
} from "./state"
import { getBalances } from "@/lib/core/wallet"
import { effectiveTier, tierLabelFor, TIER_EMOJI } from "@/lib/tiers"
import {
  tierDiscountPercent,
  getGamificationSummary,
  listMissionsForUser,
  listBadgesForUser,
  claimMission,
  recordDailyLogin,
} from "@/lib/core/gamification"
import { attachReferral, rewardReferralJoin, getReferralStats } from "@/lib/core/rewards"
import { notifyReferralJoined } from "./notify"
import {
  getOrdersForUser,
  listAuctions,
  getFlashProduct,
  getFlashDetail,
  getAuctionDetail,
} from "@/lib/core/catalog"
import { listFlashSales } from "@/lib/core/catalog"
import { listWatchlist, isWatching, addToWatchlist, removeFromWatchlist } from "@/lib/core/watchlist"
import { placeBid, buyNow } from "@/lib/core/auction"
import { evaluateCoupon } from "@/lib/core/coupons"
import {
  listNotifications,
  markRead,
  markAllRead,
  unreadCount,
} from "@/lib/core/notifications"
import {
  createTicket,
  listTickets,
  getTicket,
  replyToTicket,
  closeTicket,
} from "@/lib/core/support"
import { getPaymentConfig } from "@/lib/core/settings"
import { put } from "@vercel/blob"
import {
  getPublicGiveaway,
  enterGiveaway,
  drawGiveaway,
  setGiveawayLifecycle,
  MembershipRequiredError,
} from "@/lib/core/giveaway"
import { purchaseFixed, priceFor } from "@/lib/core/flash-sale"
import {
  createDepositRequest,
  createWithdrawalRequest,
  approveStarsDeposit,
  claimDepositPaid,
} from "@/lib/core/finance"
import { formatToman, formatDateTimeLocale } from "@/lib/format"
import { formatPrice } from "@/lib/i18n/currency"
import { tgLangToLocale, type Locale } from "@/lib/i18n/locales"
import type { BotConfig } from "./config"

type TgChat = { id: number }
type TgFrom = {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
}
type TgSuccessfulPayment = {
  currency: string
  total_amount: number
  invoice_payload: string
  telegram_payment_charge_id: string
}
type TgPhotoSize = { file_id: string; file_unique_id?: string; file_size?: number; width?: number; height?: number }
type TgMessage = {
  message_id: number
  chat: TgChat
  from?: TgFrom
  text?: string
  caption?: string
  photo?: TgPhotoSize[]
  successful_payment?: TgSuccessfulPayment
}
type TgCallback = {
  id: string
  from: TgFrom
  message?: { message_id: number; chat: TgChat }
  data?: string
}
type TgPreCheckout = { id: string; from: TgFrom; currency: string; total_amount: number; invoice_payload: string }
export type TgUpdate = {
  update_id?: number
  message?: TgMessage
  callback_query?: TgCallback
  pre_checkout_query?: TgPreCheckout
}

// --- helpers -----------------------------------------------------------------

async function cfg() {
  return getBotConfig()
}

/** Effective locale for a user: their stored language, else the bot default. */
function localeOf(c: BotConfig, user: { languageCode: string | null } | null): Locale {
  if (user?.languageCode) return tgLangToLocale(user.languageCode)
  return c.defaultLocale
}

/** Locale-aware price string (Toman for fa, USD for others). */
function price(c: BotConfig, locale: Locale, amount: bigint | number): string {
  return formatPrice(amount, locale, c.usdRate)
}

function fa(amount: bigint | number) {
  return formatToman(amount)
}

async function findUser(telegramId: number): Promise<User | null> {
  return prisma.user.findUnique({ where: { telegramId: String(telegramId) } })
}

/**
 * Maintenance gate. When maintenance mode is on, every non-admin sender is
 * shown a friendly "under maintenance" notice and their update is dropped.
 * Admins (built-in owner or DB role ADMIN) pass through so they can keep
 * testing/operating the bot. Returns true when the caller must stop.
 */
async function maintenanceBlock(telegramId: number, chatId: number): Promise<boolean> {
  const m = await getMaintenance()
  if (!m.enabled) return false
  if (await isAdminTelegram(telegramId)) return false
  const html = `🛠 <b>${esc(m.title)}</b>\n\n${esc(m.message)}`
  const markup = m.supportUrl
    ? inlineKeyboard([[{ text: "🆘 پشتیبانی", url: m.supportUrl }]])
    : undefined
  await sendMessage(chatId, html, { replyMarkup: markup })
  return true
}

/** Localized "bulk discount" note (plain text, safe to pass as a render var). */
function bulkNote(locale: Locale, percent: number, min: number): string {
  switch (locale) {
    case "en":
      return `\n🎁 Bulk discount: ${percent}% off for ${min}+ units`
    case "ru":
      return `\n🎁 Оптовая скидка: ${percent}% при ${min}+ шт.`
    case "hi":
      return `\n🎁 थोक छूट: ${min}+ यूनिट पर ${percent}% छूट`
    default:
      return `\n🎁 تخفیف عمده: ${percent}٪ برای ${min}+ عدد`
  }
}

/**
 * Telegram requires an absolute, publicly reachable URL for sendPhoto. Resolve
 * relative cover paths against the public base URL; return null when we can't
 * build an absolute https URL so callers fall back to a text message.
 */
function absImage(src: string | null | undefined): string | null {
  if (!src) return null
  if (/^https?:\/\//i.test(src)) return src
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "")
  if (!base) return null
  return `${base.replace(/\/$/, "")}/${src.replace(/^\//, "")}`
}

/** Localized HTML block of labeled product links (Activation / Warranty …). */
function linksHtml(links: { label: string; url: string }[]): string {
  if (!links.length) return ""
  return (
    "\n" +
    links
      .map((l) => `🔗 <a href="${esc(l.url)}">${esc(l.label)}</a>`)
      .join("\n")
  )
}

/** Fallback banner shown on the editable canvas for text-only sections. */
const BANNER_PATH = "/bot/banner.png"
/** Items per page in the in-chat browse lists. */
const PAGE_SIZE = 6
/** Telegram photo caption hard limit is 1024 chars; keep a safe margin. */
const CAPTION_MAX = 1000

/** Clamp a caption to Telegram's photo-caption limit (keeps closing bold sane). */
function clampCaption(html: string): string {
  if (html.length <= CAPTION_MAX) return html
  return html.slice(0, CAPTION_MAX - 1) + "…"
}

/**
 * Render the single editable "canvas" message. Every browsable/section view
 * goes through here so we edit ONE message in place instead of spamming a new
 * message per item:
 *  - a text-only section uses the brand banner as the photo;
 *  - an item detail passes the item's cover image.
 * When editing, we swap only the caption if the photo is unchanged, else swap
 * the media. Falls back to sending a fresh canvas if no edit target exists or an
 * edit fails (e.g. the message is too old / was deleted).
 */
async function renderCanvas(
  chatId: number,
  opts: { photo?: string | null; caption: string; markup?: object; editId?: number },
): Promise<number | undefined> {
  const img = absImage(opts.photo) || absImage(BANNER_PATH)
  const caption = clampCaption(opts.caption)

  if (opts.editId && img) {
    const cur = await getCanvas(chatId)
    try {
      if (cur && cur.id === opts.editId && cur.photo === img) {
        await editMessageCaption(chatId, opts.editId, caption, { replyMarkup: opts.markup })
      } else {
        await editMessageMedia(chatId, opts.editId, img, caption, { replyMarkup: opts.markup })
        await setCanvas(chatId, opts.editId, img)
      }
      return opts.editId
    } catch {
      // fall through to sending a fresh canvas
    }
  }

  if (img) {
    const msg = (await sendPhoto(chatId, img, caption, { replyMarkup: opts.markup }).catch(
      () => null,
    )) as { message_id?: number } | null
    const id = msg?.message_id
    if (id) await setCanvas(chatId, id, img)
    return id
  }
  const msg = (await sendMessage(chatId, caption, { replyMarkup: opts.markup })) as {
    message_id?: number
  }
  return msg?.message_id
}

/** Enabled deposit/top-up methods, in a stable display order. */
async function enabledPayMethods(): Promise<BotPayMethod[]> {
  const cfg = await getPaymentConfig()
  const order: BotPayMethod[] = ["CARD", "TON", "USDT", "STARS"]
  return order.filter((m) => cfg.methods.find((s) => s.method === m)?.enabled)
}

// --- command + view renderers ------------------------------------------------

async function showHome(chatId: number, user: User, opts: { edit?: number } = {}) {
  const c = await cfg()
  const locale = localeOf(c, user)
  const { html } = t(c, locale, "menuPrompt", { name: user.displayName })
  const unread = c.features.notificationsInbox ? await unreadCount(user.id).catch(() => 0) : 0
  await renderCanvas(chatId, {
    photo: BANNER_PATH,
    caption: html,
    markup: mainMenu(c, locale, unread),
    editId: opts.edit,
  })
}

async function showWelcome(chatId: number, user: User, isNew: boolean) {
  const c = await cfg()
  const locale = localeOf(c, user)
  const key = isNew ? "welcome" : "welcomeBack"
  const { html } = t(c, locale, key, { name: user.displayName, brand: c.brandName })
  const unread = c.features.notificationsInbox ? await unreadCount(user.id).catch(() => 0) : 0
  await renderCanvas(chatId, { photo: BANNER_PATH, caption: html, markup: mainMenu(c, locale, unread) })
}

/**
 * Pay the inviter's "friend joined" reward (stage A) once a referred user has
 * fully completed onboarding (started the bot AND passed the forced-join gate),
 * then push the inviter a notification. Idempotent (guarded in rewardReferralJoin)
 * and best-effort — it must never break the onboarding flow.
 */
async function completeReferralJoin(user: User) {
  try {
    const result = await rewardReferralJoin(user.id)
    if (result.rewarded && result.referrerId) {
      await notifyReferralJoined(
        result.referrerId,
        result.friendName || user.displayName,
        result.bonus ?? 0n,
      )
    }
  } catch (e) {
    console.log("[v0] completeReferralJoin error:", (e as Error).message)
  }
}

/** "Invite friends" screen: the user's personal deep link + live stats. */
async function showReferral(chatId: number, user: User, editId?: number) {
  const c = await cfg()
  const locale = localeOf(c, user)
  const stats = await getReferralStats(user.id)
  // Prefer the in-bot deep link; fall back to the web link if the bot username
  // isn't resolved yet (so the screen is always useful).
  const botLink = referralDeepLink(c, stats.code)
  const webBase = appUrl()
  const link = botLink || (webBase ? `${webBase.replace(/\/$/, "")}/?ref=${stats.code}` : stats.code)
  const { html } = t(c, locale, "referralHome", {
    link,
    total: stats.totalReferred,
    joined: stats.joinedReferred,
    rewarded: stats.rewardedReferred,
    earned: price(c, locale, stats.totalEarned),
  })
  const shareText = t(c, locale, "welcome", { name: "", brand: c.brandName }).html
    .replace(/<[^>]+>/g, "")
    .slice(0, 120)
  const markup = referralKeyboard(c, stats.code, shareText || c.brandName, locale)
  await renderCanvas(chatId, { photo: BANNER_PATH, caption: html, markup, editId })
}

async function showWallet(chatId: number, user: User, editId?: number) {
  const c = await cfg()
  const locale = localeOf(c, user)
  const b = await getBalances(user.id)
  const { html } = t(c, locale, "walletHeader", {
    total: price(c, locale, b.totalBalance),
    frozen: price(c, locale, b.frozenBalance),
    available: price(c, locale, b.availableBalance),
  })
  // Append the membership tier so the bot matches the web app. VIP overrides
  // the earned tier when an active manual grant exists.
  const tier = effectiveTier(user)
  const discount = await tierDiscountPercent(tier)
  let tierLine = `\n\n${TIER_EMOJI[tier]} <b>${esc(tierLabelFor(tier, locale))}</b>`
  if (discount > 0) tierLine += ` · ${esc(String(discount))}%`
  const body = `${html}${tierLine}`
  const markup = walletMenu(c, locale)
  await renderCanvas(chatId, { photo: BANNER_PATH, caption: body, markup, editId })
}

async function showOrders(chatId: number, user: User, editId?: number) {
  const c = await cfg()
  const locale = localeOf(c, user)
  const orders = (await getOrdersForUser(user.id)).slice(0, 8)
  if (orders.length === 0) {
    const { html } = t(c, locale, "ordersEmpty")
    await renderCanvas(chatId, { photo: BANNER_PATH, caption: html, markup: backButton(c, locale), editId })
    return
  }
  const header = t(c, locale, "ordersHeader")
  const lines = orders.map((o) => {
    const status = o.delivery?.status === "DELIVERED" ? emo(c, "check") : emo(c, "clock")
    return `${status} <b>${esc(o.title)}</b>\n   ${esc(price(c, locale, o.amount))} · ${esc(o.publicId)}`
  })
  const body = `${header.html}\n\n${lines.join("\n\n")}`
  await renderCanvas(chatId, { photo: BANNER_PATH, caption: body, markup: backButton(c, locale), editId })
}

/** Localized labels for the auction detail card. */
function aucLabels(locale: Locale) {
  switch (locale) {
    case "en":
      return { price: "Current price", next: "Min next bid", buyNow: "Buy now", ends: "Ends", bids: "Bids", scheduled: "Starts", ended: "Auction ended", reserveNo: "Reserve not met" }
    case "ru":
      return { price: "Текущая цена", next: "Мин. ставка", buyNow: "Купить сейчас", ends: "Окончание", bids: "Ставки", scheduled: "Старт", ended: "Аукцион завершён", reserveNo: "Резерв не достигнут" }
    case "hi":
      return { price: "मौजूदा कीमत", next: "न्यूनतम अगली बोली", buyNow: "अभी खरीदें", ends: "समाप्ति", bids: "बोलियाँ", scheduled: "शुरू", ended: "नीलामी समाप्त", reserveNo: "रिज़र्व पूरा नहीं" }
    default:
      return { price: "قیمت فعلی", next: "حداقل پیشنهاد بعدی", buyNow: "خرید فوری", ends: "پایان", bids: "پیشنهادها", scheduled: "شروع", ended: "مزایده پایان یافت", reserveNo: "به حد رزرو نرسیده" }
  }
}

function localeTag(locale: Locale): string {
  return locale === "fa" ? "fa-IR" : locale === "ru" ? "ru-RU" : locale === "hi" ? "hi-IN" : "en-US"
}

/** Flash-sale browse list on the editable canvas (buttons, no per-item spam). */
async function showFlash(chatId: number, locale: Locale, editId?: number, page = 0) {
  const c = await cfg()
  const all = (await listFlashSales()).filter((p) => p.stock > 0)
  if (all.length === 0) {
    const { html } = t(c, locale, "flashEmpty")
    await renderCanvas(chatId, { photo: BANNER_PATH, caption: html, markup: backButton(c, locale), editId })
    return
  }
  const start = page * PAGE_SIZE
  const items = all.slice(start, start + PAGE_SIZE)
  const header = t(c, locale, "flashHeader").html
  const lines = items.map(
    (p) => `${emo(c, "fire")} <b>${esc(p.title)}</b> — ${esc(price(c, locale, p.price))}`,
  )
  const listItems: ListItem[] = items.map((p) => ({
    id: p.id,
    label: `${p.title} — ${plain(price(c, locale, p.price))}`.slice(0, 60),
  }))
  const markup = listKeyboard(c, "flash", listItems, page, start + PAGE_SIZE < all.length, locale)
  await renderCanvas(chatId, { photo: BANNER_PATH, caption: `${header}\n\n${lines.join("\n")}`, markup, editId })
}

/** Flash-sale product detail on the canvas (swaps in the item cover image). */
async function showFlashDetail(chatId: number, locale: Locale, productId: string, page: number, editId?: number) {
  const c = await cfg()
  const p = await getFlashDetail(productId)
  if (!p) {
    const { html } = t(c, locale, "flashEmpty")
    await renderCanvas(chatId, { photo: BANNER_PATH, caption: html, markup: backButton(c, locale), editId })
    return
  }
  const bulk = p.bulkMinQty && p.bulkDiscountPercent ? bulkNote(locale, p.bulkDiscountPercent, p.bulkMinQty) : ""
  const { html } = t(c, locale, "productCard", {
    title: p.title,
    price: price(c, locale, p.price),
    stock: p.stock,
    sold: p.soldDisplay,
    bulk,
    links: "",
  })
  let caption = html + linksHtml(p.links)
  if (p.ratingCount > 0 && p.ratingAvg != null) {
    caption += `\n${emo(c, "star")} ${esc(String(p.ratingAvg))} (${esc(String(p.ratingCount))})`
  }
  const markup = flashDetailKeyboard(c, p.id, page, locale)
  await renderCanvas(chatId, { photo: p.coverImage || BANNER_PATH, caption, markup, editId })
}

/** Auction browse list on the editable canvas. */
async function showAuctions(chatId: number, locale: Locale, editId?: number, page = 0) {
  const c = await cfg()
  const all = (await listAuctions()).filter((a) => a.status === "ACTIVE" || a.status === "SCHEDULED")
  if (all.length === 0) {
    const empty = `${emo(c, "gavel")} —`
    await renderCanvas(chatId, { photo: BANNER_PATH, caption: empty, markup: backButton(c, locale), editId })
    return
  }
  const start = page * PAGE_SIZE
  const items = all.slice(start, start + PAGE_SIZE)
  const header = `${emo(c, "gavel")} <b>${esc(c.brandName)}</b>`
  const lines = items.map(
    (a) => `${emo(c, "gavel")} <b>${esc(a.title)}</b> — ${esc(price(c, locale, a.currentPrice))} · ${esc(String(a.bidCount))}`,
  )
  const listItems: ListItem[] = items.map((a) => ({
    id: a.id,
    label: `${a.title} — ${plain(price(c, locale, a.currentPrice))}`.slice(0, 60),
  }))
  const markup = listKeyboard(c, "auc", listItems, page, start + PAGE_SIZE < all.length, locale)
  await renderCanvas(chatId, { photo: BANNER_PATH, caption: `${header}\n\n${lines.join("\n")}`, markup, editId })
}

/** Auction detail on the canvas with in-chat bid / buy-now / watch actions. */
async function showAuctionDetail(chatId: number, user: User, auctionId: string, page: number, editId?: number) {
  const c = await cfg()
  const locale = localeOf(c, user)
  let a: Awaited<ReturnType<typeof getAuctionDetail>>
  try {
    a = await getAuctionDetail(auctionId)
  } catch {
    await renderCanvas(chatId, { photo: BANNER_PATH, caption: `${emo(c, "cross")} —`, markup: backButton(c, locale), editId })
    return
  }
  const L = aucLabels(locale)
  const active = a.status === "ACTIVE"
  const watching = await isWatching(user.id, auctionId).catch(() => false)
  const ends = formatDateTimeLocale(a.endTime, localeTag(locale))
  const lines = [
    `${emo(c, "gavel")} <b>${esc(a.title)}</b>`,
    "",
    `${emo(c, "money")} ${esc(L.price)}: <b>${esc(price(c, locale, a.currentPrice))}</b>`,
  ]
  if (active) lines.push(`${emo(c, "chart")} ${esc(L.next)}: <b>${esc(price(c, locale, a.minNextBid))}</b>`)
  if (a.buyNowPrice) lines.push(`${emo(c, "cart")} ${esc(L.buyNow)}: <b>${esc(price(c, locale, a.buyNowPrice))}</b>`)
  lines.push(`${emo(c, "clock")} ${esc(L.ends)}: ${esc(ends)}`)
  lines.push(`${emo(c, "eye")} ${esc(L.bids)}: ${esc(String(a.bidCount))}`)
  if (a.hasReserve && !a.reserveMet) lines.push(`${emo(c, "warning")} ${esc(L.reserveNo)}`)
  if (!active && a.status !== "SCHEDULED") lines.push(`\n${emo(c, "cross")} ${esc(L.ended)}`)
  const markup = auctionDetailKeyboard(
    c,
    a.id,
    page,
    { canBuyNow: Boolean(a.buyNowPrice), watching, active },
    locale,
  )
  await renderCanvas(chatId, { photo: a.coverImage || BANNER_PATH, caption: lines.join("\n"), markup, editId })
}

async function showWatchlist(chatId: number, user: User, editId?: number) {
  const c = await cfg()
  const locale = localeOf(c, user)
  const items = (await listWatchlist(user.id)).slice(0, 8)
  if (items.length === 0) {
    const { html } = t(c, locale, "watchlistEmpty")
    if (editId) await editMessageText(chatId, editId, html, { replyMarkup: backButton(c, locale) })
    else await sendMessage(chatId, html, { replyMarkup: backButton(c, locale) })
    return
  }
  const header = t(c, locale, "watchlistHeader")
  const lines = items.map(
    (a) => `${emo(c, "gavel")} <b>${esc(a.title)}</b>\n   ${esc(price(c, locale, a.currentPrice))} · ${esc(a.bidCount)}`,
  )
  const body = `${header.html}\n\n${lines.join("\n\n")}`
  if (editId) await editMessageText(chatId, editId, body, { replyMarkup: backButton(c, locale) })
  else await sendMessage(chatId, body, { replyMarkup: backButton(c, locale) })
}

async function showHelp(chatId: number, locale: Locale, editId?: number) {
  const c = await cfg()
  const { html } = t(c, locale, "help", { brand: c.brandName })
  if (editId) await editMessageText(chatId, editId, html, { replyMarkup: backButton(c, locale) })
  else await sendMessage(chatId, html, { replyMarkup: backButton(c, locale) })
}

// --- giveaways ----------------------------------------------------------------

/** Tiny per-locale label bag for the giveaway card (content itself is authored). */
function gwLabels(locale: Locale) {
  switch (locale) {
    case "en":
      return {
        prize: "Prize", winners: "Winners", participants: "Participants",
        drawAt: "Draw", enter: "🎉 Enter giveaway", entered: "✅ You're entered",
        open: "Open in app", results: "🏆 View results", join: "Join channels first",
        ended: "This giveaway has ended", retry: "✅ I joined — retry",
        entrySaved: "Done! You're entered. Good luck 🍀", joinNeeded: "Join the required channels, then tap retry.",
      }
    case "ru":
      return {
        prize: "Приз", winners: "Победители", participants: "Участники",
        drawAt: "Розыгрыш", enter: "🎉 Участвовать", entered: "✅ Вы участвуете",
        open: "Открыть в приложении", results: "🏆 Результаты", join: "Сначала подпишитесь",
        ended: "Розыгрыш завершён", retry: "✅ Я подписался — повторить",
        entrySaved: "Готово! Вы участвуете. Удачи 🍀", joinNeeded: "Подпишитесь на каналы и нажмите повторить.",
      }
    case "hi":
      return {
        prize: "इनाम", winners: "विजेता", participants: "प्रतिभागी",
        drawAt: "ड्रॉ", enter: "🎉 भा��� लें", entered: "✅ आप शामिल हैं",
        open: "ऐप में खोलें", results: "🏆 परिणाम देखें", join: "पहले चैनल जॉइन करें",
        ended: "यह गिववे समाप्त हो गया", retry: "✅ मैंने जॉइन किया — पुनः प्रयास",
        entrySaved: "हो गया! आप शामिल हैं। शुभकामनाएँ 🍀", joinNeeded: "चैनल जॉइन करें, फिर पुनः प्रयास करें।",
      }
    default:
      return {
        prize: "جایزه", winners: "برندگان", participants: "شرکت‌کنندگان",
        drawAt: "زمان قرعه‌کشی", enter: "🎉 شرکت در قرعه‌کشی", entered: "✅ شما ثبت‌نام کرده‌اید",
        open: "مشاهده در اپ", results: "🏆 مشاهده نتایج", join: "ابتدا در کانال‌ها عضو شوید",
        ended: "این قرعه‌کشی به پایان رسیده است", retry: "✅ عضو شدم — تلاش مجدد",
        entrySaved: "ثبت شد! شرکت شما با موفقیت انجام شد. موفق باشید 🍀",
        joinNeeded: "در کانال‌های الزامی عضو شو و سپس دوباره تلاش کن.",
      }
  }
}

/** Build the giveaway card caption + action keyboard for a given user/state. */
function giveawayCardMarkup(
  gw: Awaited<ReturnType<typeof getPublicGiveaway>>,
  locale: Locale,
) {
  const L = gwLabels(locale)
  const appBtn = (() => {
    const base = appUrl()
    return base ? { text: L.open, web_app: { url: `${base.replace(/\/$/, "")}/giveaways/${gw.slug}` } } : null
  })()

  const rows: { text: string; url?: string; callback_data?: string; web_app?: { url: string }; style?: "success" | "primary" }[][] = []
  if (gw.status === "FINISHED") {
    if (appBtn) rows.push([{ ...appBtn, text: L.results }])
  } else if (gw.status === "ACTIVE") {
    if (gw.entered) {
      rows.push([{ text: L.entered, callback_data: `gw:noop:${gw.id}` }])
      if (appBtn) rows.push([appBtn])
    } else {
      rows.push([{ text: L.enter, callback_data: `gw:enter:${gw.id}`, style: "success" }])
      if (appBtn) rows.push([appBtn])
    }
  } else if (appBtn) {
    rows.push([appBtn])
  }
  return inlineKeyboard(rows)
}

function giveawayCaption(gw: Awaited<ReturnType<typeof getPublicGiveaway>>, locale: Locale) {
  const L = gwLabels(locale)
  const draw = formatDateTimeLocale(
    gw.drawAt,
    locale === "fa" ? "fa-IR" : locale === "ru" ? "ru-RU" : locale === "hi" ? "hi-IN" : "en-US",
  )
  const lines = [
    `🎁 <b>${esc(gw.title)}</b>`,
    gw.subtitle ? esc(gw.subtitle) : "",
    "",
    `🏆 <b>${L.prize}:</b> ${esc(gw.prizeLabel)}`,
    `🥇 <b>${L.winners}:</b> ${gw.winnersCount}`,
    `👥 <b>${L.participants}:</b> ${gw.participants}`,
    `⏰ <b>${L.drawAt}:</b> ${esc(draw)}`,
  ]
  if (gw.status === "FINISHED" && gw.winners.length) {
    lines.push("", `🎉 <b>${L.winners}:</b>`)
    for (const w of gw.winners) lines.push(`  ${w.position}. ${esc(w.name)}${w.username ? ` (${esc(w.username)})` : ""}`)
  }
  return lines.filter((l) => l !== undefined).join("\n")
}

/** Keyboard shown when a giveaway entry is blocked by required-channel membership. */
function giveawayJoinKeyboard(
  giveawayId: string,
  missing: { id: string; title: string; url: string }[],
  retryLabel: string,
) {
  const rows = missing.filter((m) => m.url).map((m) => [{ text: `📢 ${m.title}`, url: m.url }])
  rows.push([{ text: retryLabel, callback_data: `gw:enter:${giveawayId}` } as never])
  return inlineKeyboard(rows as never)
}

async function showGiveawayCard(chatId: number, user: User, slug: string, editId?: number) {
  const c = await cfg()
  const locale = localeOf(c, user)
  let gw: Awaited<ReturnType<typeof getPublicGiveaway>>
  try {
    gw = await getPublicGiveaway(slug, user.id)
  } catch {
    await sendMessage(chatId, `${emo(c, "cross")} —`, { replyMarkup: backButton(c, locale) })
    return
  }
  const caption = giveawayCaption(gw, locale)
  const markup = giveawayCardMarkup(gw, locale)
  const img = absImage(gw.prizeImage || gw.coverImage)
  if (editId) {
    await editMessageText(chatId, editId, caption, { replyMarkup: markup })
  } else if (img) {
    await sendPhoto(chatId, img, caption, { replyMarkup: markup }).catch(async () => {
      await sendMessage(chatId, caption, { replyMarkup: markup })
    })
  } else {
    await sendMessage(chatId, caption, { replyMarkup: markup })
  }
}

async function showLanguage(chatId: number, locale: Locale, editId?: number) {
  const c = await cfg()
  const { html } = t(c, locale, "chooseLanguage")
  const markup = languageKeyboard(c, locale)
  if (editId) await editMessageText(chatId, editId, html, { replyMarkup: markup })
  else await sendMessage(chatId, html, { replyMarkup: markup })
}

// --- onboarding + forced-join gate -------------------------------------------

/** Strip HTML tags for use in plain-text callback toasts. */
function plain(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim()
}

/** First-run language picker (no Back button — language must be chosen). */
async function showLanguageOnboarding(chatId: number, locale: Locale) {
  const c = await cfg()
  const { html } = t(c, locale, "chooseLanguageWelcome")
  await sendMessage(chatId, html, { replyMarkup: languageKeyboard(c, locale, false) })
}

/** Render the forced-join screen with the channels the user still must join. */
async function showJoinGate(
  chatId: number,
  locale: Locale,
  missing: { id: string; title: string; url: string }[],
  revoked: boolean,
  editId?: number,
) {
  const c = await cfg()
  const { html } = t(c, locale, revoked ? "accessRevoked" : "joinRequired", { brand: c.brandName })
  const markup = forcedJoinKeyboard(c, locale, missing)
  if (editId) await editMessageText(chatId, editId, html, { replyMarkup: markup })
  else await sendMessage(chatId, html, { replyMarkup: markup })
}

/**
 * Forced-join guard for any interaction after onboarding. Returns true when the
 * user may proceed; otherwise shows the (localized) "access revoked" screen and
 * returns false. Cheap when forced join is off (no Telegram calls).
 */
async function ensureAccess(chatId: number, user: User, locale: Locale): Promise<boolean> {
  const c = await cfg()
  if (!forcedJoinActive(c) || !user.telegramId) return true
  const res = await checkMemberships(c, user.telegramId)
  if (res.ok) return true
  await clearMembershipCache(user.telegramId)
  await showJoinGate(chatId, locale, res.missing, true)
  return false
}

// --- entry points ------------------------------------------------------------

async function handleMessage(msg: TgMessage) {
  const chatId = msg.chat.id
  const from = msg.from
  if (!from) return
  // Maintenance mode: block non-admins before any command handling.
  if (await maintenanceBlock(from.id, chatId)) return
  const text = (msg.text || "").trim()
  const c = await cfg()

  // /start (and account auto-creation). Supports deep links: /start p_<id>.
  if (text.startsWith("/start")) {
    const payload = text.split(" ")[1]?.trim()
    const existing = await findUser(from.id)
    const user = await resolveTelegramUser({ ...from, chatId })
    const locale = localeOf(c, user)

    // Referral deep link (/start ref_<CODE>): record the inviter immediately so
    // it survives even if onboarding (language / forced-join) interrupts the
    // flow. The actual "joined" reward is paid only once the user passes the
    // forced-join gate (see completeReferralJoin below). Safe no-op if the user
    // is already referred or the code is their own / unknown.
    if (payload && payload.startsWith("ref_")) {
      await attachReferral(user.id, payload.slice(4)).catch(() => {})
    }

    // Step 1 — first contact: force a language choice before anything else.
    if (!user.localeManual) {
      await showLanguageOnboarding(chatId, locale)
      return
    }

    // Step 2 — forced-join gate: must be a member of every required channel.
    if (forcedJoinActive(c)) {
      const access = await checkMemberships(c, from.id, { force: true })
      if (!access.ok) {
        await showJoinGate(chatId, locale, access.missing, false)
        return
      }
    }

    // Onboarding fully complete (passed the forced-join gate) → settle the
    // inviter's "friend joined" reward exactly once.
    await completeReferralJoin(user)

    // Step 3 — proceed (product / giveaway deep link or the main menu).
    if (payload && payload.startsWith("p_")) {
      const productId = payload.slice(2)
      const product = await getFlashProduct(productId)
      if (product) {
        await showFlashDetail(chatId, locale, productId, 0)
        return
      }
    }
    // Giveaway deep link (/start g_<slug>): show the giveaway card with an
    // in-bot entry button. The user has already cleared the global forced-join
    // gate above; campaign-specific channels are enforced at entry time.
    if (payload && payload.startsWith("g_")) {
      await showGiveawayCard(chatId, user, payload.slice(2))
      return
    }
    await showWelcome(chatId, user, !existing)
    return
  }

  const user = await findUser(from.id)
  if (!user) {
    const locale = localeOf(c, null)
    const { html } = t(c, locale, "notRegistered")
    await sendMessage(chatId, html)
    return
  }

  const userLocale = localeOf(c, user)
  // Not onboarded yet → force the language choice first.
  if (!user.localeManual) {
    await showLanguageOnboarding(chatId, userLocale)
    return
  }
  // Forced-join guard: blocks access (and shows the join screen) if they left.
  if (!(await ensureAccess(chatId, user, userLocale))) return

  // Pending conversation flows (deposit/withdraw/quantity/bid/coupon/support).
  const pending = await getPending(chatId)
  if (pending) {
    // A receipt upload arrives as a photo message (no text).
    if (msg.photo?.length && pending.kind === "awaiting_deposit_receipt") {
      await handleReceiptPhoto(chatId, user, pending, msg.photo)
      return
    }
    if (text && !text.startsWith("/")) {
      await handlePendingInput(chatId, user, pending, text)
      return
    }
  }

  switch (text.split(" ")[0]) {
    case "/menu":
      return showHome(chatId, user)
    case "/wallet":
      return showWallet(chatId, user)
    case "/orders":
      return showOrders(chatId, user)
    case "/flash":
      return showFlash(chatId, localeOf(c, user))
    case "/auctions":
      return showAuctions(chatId, localeOf(c, user))
    case "/watchlist":
      return showWatchlist(chatId, user)
    case "/profile":
      return showProfile(chatId, user)
    case "/rewards":
      return showRewards(chatId, user)
    case "/notifications":
      return showNotifications(chatId, user)
    case "/support":
      return showSupport(chatId, user)
    case "/language":
      return showLanguage(chatId, localeOf(c, user))
    case "/app": {
      const locale = localeOf(c, user)
      const markup = openAppKeyboard(c, "", locale)
      if (markup) {
        await sendMessage(chatId, `${emo(c, "rocket")}`, { replyMarkup: markup })
      } else {
        await sendMessage(chatId, "—")
      }
      return
    }
    case "/help":
      return showHelp(chatId, localeOf(c, user))
    default:
      return showHome(chatId, user)
  }
}

async function handlePendingInput(
  chatId: number,
  user: User,
  pending: PendingAction,
  text: string,
) {
  const c = await cfg()
  const locale = localeOf(c, user)

  switch (pending.kind) {
    case "awaiting_quantity":
      return handleQuantityInput(chatId, user, locale, pending.productId, text, pending.couponCode)
    case "awaiting_bid_amount":
      return handleBidInput(chatId, user, locale, pending.auctionId, text)
    case "awaiting_coupon_code":
      return handleCouponInput(chatId, user, locale, pending.productId, text)
    case "awaiting_support_subject":
      return handleSupportSubject(chatId, user, locale, text)
    case "awaiting_support_message":
      return handleSupportMessage(chatId, user, locale, pending.subject, text)
    case "awaiting_ticket_reply":
      return handleTicketReply(chatId, user, locale, pending.ticketId, text)
    case "awaiting_deposit_receipt": {
      const L = secLabels(locale)
      await sendMessage(chatId, `${emo(c, "warning")} ${esc(L.receiptPhotoOnly)}`)
      return
    }
    case "awaiting_deposit_amount":
    case "awaiting_withdraw_amount": {
      const amount = parseAmount(text)
      if (amount == null) {
        await sendMessage(chatId, `${emo(c, "warning")} 500000`)
        return
      }
      await clearPending(chatId)
      try {
        if (pending.kind === "awaiting_deposit_amount") {
          await startDepositForMethod(chatId, user, locale, pending.method, amount)
        } else {
          await createWithdrawalRequest({ userId: user.id, amount, note: "Telegram bot" })
          const { html } = t(c, locale, "withdrawReceived", { amount: fa(amount) })
          await sendMessage(chatId, html, { replyMarkup: mainMenu(c, locale) })
        }
      } catch (e) {
        await sendMessage(chatId, `${emo(c, "cross")} ${esc((e as Error).message)}`)
      }
      return
    }
  }
}

/**
 * Validate the quantity, persist an order draft (product + qty + optional
 * coupon), then present the payment-method chooser. The draft keeps the coupon
 * out of the callback data (which would be unsafe / length-limited).
 */
async function handleQuantityInput(
  chatId: number,
  user: User,
  locale: Locale,
  productId: string,
  text: string,
  couponCode?: string,
) {
  const c = await cfg()
  const product = await getFlashProduct(productId)
  if (!product || product.stock < 1) {
    await clearPending(chatId)
    const { html } = t(c, locale, "flashEmpty")
    await sendMessage(chatId, html, { replyMarkup: mainMenu(c, locale) })
    return
  }
  const max = product.stock
  const qty = parseQuantity(text)
  if (qty == null || qty < 1 || qty > max) {
    const { html } = t(c, locale, "quantityInvalid", { min: 1, max })
    await sendMessage(chatId, html)
    return
  }
  await clearPending(chatId)
  await setOrderDraft(chatId, { productId, qty, couponCode })

  // Preview total, applying the coupon when it validates for this subtotal.
  const { totalPrice } = priceFor(product, qty)
  let payable = totalPrice
  if (couponCode) {
    try {
      const { preview } = await evaluateCoupon(prisma, couponCode, totalPrice, user.id)
      payable = preview.finalTotal
    } catch {
      /* coupon no longer valid at this subtotal — fall back to full total */
    }
  }
  const L = secLabels(locale)
  const couponLine = couponCode ? `\n🏷️ ${esc(L.couponApplied)}: <code>${esc(couponCode)}</code>` : ""
  const { html } = t(c, locale, "selectPayment", {
    orderTitle: `${product.title} ×${qty}`,
    total: price(c, locale, payable),
  })
  const methods = await enabledPayMethods()
  await sendMessage(chatId, `${html}${couponLine}`, {
    replyMarkup: orderPayKeyboard(c, productId, qty, methods, locale),
  })
}

function parseQuantity(text: string): number | null {
  const normalized = text
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[,٬\s]/g, "")
  if (!/^\d+$/.test(normalized)) return null
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

function parseAmount(text: string): bigint | null {
  // Accept Persian and English digits, ignore separators.
  const normalized = text
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[,٬\s]/g, "")
  if (!/^\d+$/.test(normalized)) return null
  try {
    const v = BigInt(normalized)
    return v > 0n ? v : null
  } catch {
    return null
  }
}

// --- profile / rewards / notifications / support / deposits ------------------

interface SecLabelBag {
  profileTitle: string; points: string; tier: string; streak: string; spent: string; referrals: string
  rewardsTitle: string; noMissions: string; claim: string; claimedOk: string; claimFail: string
  notifTitle: string; notifEmpty: string; allRead: string
  supportTitle: string; supportEmpty: string; subjectPrompt: string; messagePrompt: string
  subjectShort: string; ticketCreated: string; ticketReplied: string; ticketNotFound: string
  stOpen: string; stPending: string; stClosed: string
  couponApplied: string; couponOk: string; couponInvalid: string; couponNoProduct: string
  bidPrompt: string; bidInvalid: string; bidPlaced: string; buyNowDone: string
  watchOn: string; watchOff: string
  depositChoose: string; depInstrTitle: string; depAmount: string; depAddress: string
  depNetwork: string; depTag: string; depNote: string; toman: string
  receiptPrompt: string; receiptSaved: string; receiptPhotoOnly: string
  paidClaimed: string; paidClaimedShort: string; methodUnavailable: string
  starsInvoiceTitle: string; starsInvoiceDesc: string
}

/** One localized label bag for every bot-only section not covered by `t()`. */
function secLabels(locale: Locale): SecLabelBag {
  const dict: Record<Locale, SecLabelBag> = {
    fa: {
      profileTitle: "پروفایل من", points: "امتیاز", tier: "سطح", streak: "روزهای پیاپی", spent: "مجموع خرید", referrals: "دعوت‌های موفق",
      rewardsTitle: "جوایز و ماموریت‌ها", noMissions: "ماموریتی فعال نیست.", claim: "دریافت جایزه", claimedOk: "جایزه دریافت شد!", claimFail: "قابل دریافت نیست",
      notifTitle: "اعلان‌ها", notifEmpty: "اعلانی ندارید.", allRead: "همه خوانده شد",
      supportTitle: "پشتیبانی", supportEmpty: "تیکتی ندارید.", subjectPrompt: "موضوع تیکت را بنویسید:", messagePrompt: "متن پیام خود را بنویسید:",
      subjectShort: "موضوع باید حداقل ۳ نویسه باشد.", ticketCreated: "تیکت ثبت شد:", ticketReplied: "پاسخ شما ثبت شد.", ticketNotFound: "تیکت یافت نشد.",
      stOpen: "باز", stPending: "در انتظار", stClosed: "بسته",
      couponApplied: "کد تخفیف", couponOk: "کد تخفیف اعمال شد.", couponInvalid: "کد تخفیف معتبر نیست.", couponNoProduct: "ابتدا یک محصول را باز کنید.",
      bidPrompt: "مبلغ پیشنهاد خود را وارد کنید. حداقل:", bidInvalid: "مبلغ معتبر وارد کنید.", bidPlaced: "پیشنهاد شما ثبت شد.", buyNowDone: "با خرید فوری خریداری شد!",
      watchOn: "به لیست علاقه‌مندی افزوده شد.", watchOff: "از لیست علاقه‌مندی حذف شد.",
      depositChoose: "روش واریز را انتخاب کنید:", depInstrTitle: "راهنمای پرداخت", depAmount: "مبلغ", depAddress: "مقصد",
      depNetwork: "شبکه", depTag: "کد پیگیری", depNote: "پس از پرداخت روی «پرداخت کردم» بزنید یا رسید را ارسال کنید.", toman: "تومان",
      receiptPrompt: "لطفاً تصویر رسید پرداخت را ارسال کنید.", receiptSaved: "رسید دریافت شد. به‌زودی بررسی می‌شود.", receiptPhotoOnly: "لطفاً یک تصویر (عکس) ارسال کنید.",
      paidClaimed: "سپاس! پرداخت شما بررسی و کیف پول شارژ می‌شود.", paidClaimedShort: "ثبت شد", methodUnavailable: "این روش پرداخت در دسترس نیست",
      starsInvoiceTitle: "شارژ کیف پول", starsInvoiceDesc: "افزایش موجودی به میزان",
    },
    en: {
      profileTitle: "My profile", points: "Points", tier: "Tier", streak: "Streak", spent: "Total spent", referrals: "Referrals",
      rewardsTitle: "Rewards & missions", noMissions: "No active missions.", claim: "Claim", claimedOk: "Reward claimed!", claimFail: "Not claimable",
      notifTitle: "Notifications", notifEmpty: "No notifications.", allRead: "All read",
      supportTitle: "Support", supportEmpty: "No tickets yet.", subjectPrompt: "Enter the ticket subject:", messagePrompt: "Enter your message:",
      subjectShort: "Subject must be at least 3 characters.", ticketCreated: "Ticket created:", ticketReplied: "Your reply was posted.", ticketNotFound: "Ticket not found.",
      stOpen: "Open", stPending: "Pending", stClosed: "Closed",
      couponApplied: "Coupon", couponOk: "Coupon applied.", couponInvalid: "This coupon isn't valid.", couponNoProduct: "Open a product first.",
      bidPrompt: "Enter your bid amount. Minimum:", bidInvalid: "Enter a valid amount.", bidPlaced: "Your bid was placed.", buyNowDone: "Purchased via Buy Now!",
      watchOn: "Added to your watchlist.", watchOff: "Removed from your watchlist.",
      depositChoose: "Choose a top-up method:", depInstrTitle: "Payment instructions", depAmount: "Amount", depAddress: "Destination",
      depNetwork: "Network", depTag: "Reference", depNote: "After paying, tap “I paid” or send the receipt.", toman: "Toman",
      receiptPrompt: "Please send a photo of your payment receipt.", receiptSaved: "Receipt received. We'll verify it shortly.", receiptPhotoOnly: "Please send a photo.",
      paidClaimed: "Thanks! We'll verify your payment and credit your wallet.", paidClaimedShort: "Noted", methodUnavailable: "This payment method is unavailable",
      starsInvoiceTitle: "Wallet top-up", starsInvoiceDesc: "Add balance of",
    },
    ru: {
      profileTitle: "Мой профиль", points: "Баллы", tier: "Уровень", streak: "Серия", spent: "Всего потрачено", referrals: "Приглашения",
      rewardsTitle: "Награды и задания", noMissions: "Нет активных заданий.", claim: "Получить", claimedOk: "Награда получена!", claimFail: "Недоступно",
      notifTitle: "Уведомления", notifEmpty: "Нет уведомлений.", allRead: "Всё прочитано",
      supportTitle: "Поддержка", supportEmpty: "Пока нет обращений.", subjectPrompt: "Введите тему обращения:", messagePrompt: "Введите сообщение:",
      subjectShort: "Тема должна быть не короче 3 символов.", ticketCreated: "Обращение создано:", ticketReplied: "Ваш ответ отправлен.", ticketNotFound: "Обращение не найдено.",
      stOpen: "Открыт", stPending: "В ожидании", stClosed: "Закрыт",
      couponApplied: "Купон", couponOk: "Купон применён.", couponInvalid: "Купон недействителен.", couponNoProduct: "Сначала откройте товар.",
      bidPrompt: "Введите сумму ставки. Минимум:", bidInvalid: "Введите корректную сумму.", bidPlaced: "Ставка принята.", buyNowDone: "Куплено через «Купить сейчас»!",
      watchOn: "Добавлено в избранное.", watchOff: "Удалено из избранного.",
      depositChoose: "Выберите способ пополнения:", depInstrTitle: "Инструкция по оплате", depAmount: "Сумма", depAddress: "Получатель",
      depNetwork: "Сеть", depTag: "Код", depNote: "После оплаты нажмите «Я оплатил» или пришлите чек.", toman: "Томан",
      receiptPrompt: "Пришлите фото чека об оплате.", receiptSaved: "Чек получен. Скоро проверим.", receiptPhotoOnly: "Пришлите, пожалуйста, фото.",
      paidClaimed: "Спасибо! Мы проверим оплату и пополним кошелёк.", paidClaimedShort: "Принято", methodUnavailable: "Этот способ оплаты недоступен",
      starsInvoiceTitle: "Пополнение кошелька", starsInvoiceDesc: "Пополнить на",
    },
    hi: {
      profileTitle: "मेरी प्रोफ़ाइल", points: "अंक", tier: "स्तर", streak: "लगातार दिन", spent: "कुल खर्च", referrals: "रेफ़रल",
      rewardsTitle: "पुरस्कार और मिशन", noMissions: "कोई सक्रिय मिशन नहीं।", claim: "प्राप्त करें", claimedOk: "पुरस्कार मिल गया!", claimFail: "उपलब्ध नहीं",
      notifTitle: "सूचनाएँ", notifEmpty: "कोई सूचना नहीं।", allRead: "सब पढ़ा गया",
      supportTitle: "सहायता", supportEmpty: "अभी कोई टिकट नहीं।", subjectPrompt: "टिकट का विषय लिखें:", messagePrompt: "अपना संदेश लिखें:",
      subjectShort: "विषय कम से कम 3 अक्षर का हो।", ticketCreated: "टिकट बन गया:", ticketReplied: "आपका उत्तर भेजा गया।", ticketNotFound: "टिकट नहीं मिला।",
      stOpen: "खुला", stPending: "लंबित", stClosed: "बंद",
      couponApplied: "कूपन", couponOk: "कूपन लागू हुआ।", couponInvalid: "यह कूपन मान्य नहीं है।", couponNoProduct: "पहले कोई उत्पाद खोलें।",
      bidPrompt: "अपनी बोली राशि दर्ज करें। न्यूनतम:", bidInvalid: "मान्य राशि दर्ज करें।", bidPlaced: "आपकी बोली दर्ज हुई।", buyNowDone: "अभी खरीदें से खरीदा गया!",
      watchOn: "वॉचलिस्ट में जोड़ा गया।", watchOff: "वॉचलिस्ट से हटाया गया।",
      depositChoose: "टॉप-अप विधि चुनें:", depInstrTitle: "भुगतान निर्देश", depAmount: "राशि", depAddress: "गंतव्य",
      depNetwork: "नेटवर्क", depTag: "संदर्भ", depNote: "भुगतान के बाद “मैंने भुगतान किया” दबाएँ या रसीद भेजें।", toman: "तोमान",
      receiptPrompt: "कृपया भुगतान रसीद की फ़ोटो भेजें।", receiptSaved: "रसीद मिल गई। हम जल्द जाँचेंगे।", receiptPhotoOnly: "कृपया एक फ़ोटो भेजें।",
      paidClaimed: "धन्यवाद! हम भुगतान जाँचकर वॉलेट में जोड़ देंगे।", paidClaimedShort: "दर्ज", methodUnavailable: "यह भुगतान विधि उपलब्ध नहीं है",
      starsInvoiceTitle: "वॉलेट टॉप-अप", starsInvoiceDesc: "इतनी राशि जोड़ें",
    },
  }
  return dict[locale] ?? dict.fa
}

/** Localized label for a support-ticket status. */
function ticketStatusLabel(L: SecLabelBag, status: string): string {
  return status === "CLOSED" ? L.stClosed : status === "PENDING" ? L.stPending : L.stOpen
}

/** Profile card: points, tier, login streak, spend and referral totals. */
async function showProfile(chatId: number, user: User, editId?: number) {
  const c = await cfg()
  const locale = localeOf(c, user)
  const L = secLabels(locale)
  await recordDailyLogin(user.id).catch(() => {})
  const [summary, refs] = await Promise.all([
    getGamificationSummary(user.id),
    getReferralStats(user.id).catch(() => null),
  ])
  const tier = effectiveTier(user)
  const lines = [
    `${emo(c, "trophy")} <b>${esc(L.profileTitle)}</b>`,
    "",
    `${emo(c, "star")} ${esc(L.points)}: <b>${esc(fa(summary?.loyaltyPoints ?? 0))}</b>`,
    `${TIER_EMOJI[tier]} ${esc(L.tier)}: <b>${esc(tierLabelFor(tier, locale))}</b>`,
    `${emo(c, "fire")} ${esc(L.streak)}: <b>${esc(fa(summary?.loginStreak ?? 0))}</b>`,
    `${emo(c, "cart")} ${esc(L.spent)}: <b>${esc(price(c, locale, BigInt(summary?.totalSpent ?? "0")))}</b>`,
  ]
  if (refs) lines.push(`${emo(c, "gift")} ${esc(L.referrals)}: <b>${esc(fa(refs.joinedReferred))}</b>`)
  await renderCanvas(chatId, { photo: BANNER_PATH, caption: lines.join("\n"), markup: backButton(c, locale), editId })
}

/** Rewards screen: points balance, mission progress and claimable rewards. */
async function showRewards(chatId: number, user: User, editId?: number) {
  const c = await cfg()
  const locale = localeOf(c, user)
  const L = secLabels(locale)
  const [summary, missions] = await Promise.all([
    getGamificationSummary(user.id),
    listMissionsForUser(user.id),
  ])
  const header = `${emo(c, "gift")} <b>${esc(L.rewardsTitle)}</b>`
  const pts = `${emo(c, "star")} ${esc(L.points)}: <b>${esc(fa(summary?.loyaltyPoints ?? 0))}</b>`
  const missionLines = missions.slice(0, 8).map((m) => {
    const state = m.claimed ? "✅" : m.completed ? "🎁" : `${fa(m.progress)}/${fa(m.target)}`
    return `• <b>${esc(m.title)}</b> — ${esc(state)} (+${esc(fa(m.rewardPoints))})`
  })
  const claimable: ListItem[] = missions
    .filter((m) => m.completed && !m.claimed)
    .map((m) => ({ id: m.id, label: `${L.claim}: ${m.title}`.slice(0, 60) }))
  const body = missionLines.length ? missionLines.join("\n") : esc(L.noMissions)
  await renderCanvas(chatId, {
    photo: BANNER_PATH,
    caption: `${header}\n${pts}\n\n${body}`,
    markup: rewardsKeyboard(c, claimable, locale),
    editId,
  })
}

/** Notifications inbox on the canvas, paginated with a mark-all-read action. */
async function showNotifications(chatId: number, user: User, editId?: number, page = 0) {
  const c = await cfg()
  const locale = localeOf(c, user)
  const L = secLabels(locale)
  const { items, unread } = await listNotifications(user.id, { limit: 100 })
  const header = `${emo(c, "bell")} <b>${esc(L.notifTitle)}</b>`
  if (items.length === 0) {
    await renderCanvas(chatId, {
      photo: BANNER_PATH,
      caption: `${header}\n\n${esc(L.notifEmpty)}`,
      markup: backButton(c, locale),
      editId,
    })
    return
  }
  const start = page * PAGE_SIZE
  const pageItems = items.slice(start, start + PAGE_SIZE)
  const lines = pageItems.map(
    (n) => `${n.read ? "▫️" : "🔵"} <b>${esc(n.title)}</b>\n   ${esc(n.body.slice(0, 80))}`,
  )
  const listItems: ListItem[] = pageItems.map((n) => ({
    id: n.id,
    label: `${n.read ? "" : "🔵 "}${n.title}`.slice(0, 60),
  }))
  const markup = notificationsKeyboard(c, listItems, page, start + PAGE_SIZE < items.length, unread > 0, locale)
  await renderCanvas(chatId, { photo: BANNER_PATH, caption: `${header}\n\n${lines.join("\n")}`, markup, editId })
}

/** Support home: ticket list + New-ticket action. */
async function showSupport(chatId: number, user: User, editId?: number) {
  const c = await cfg()
  const locale = localeOf(c, user)
  const L = secLabels(locale)
  const tickets = await listTickets(user.id)
  const header = `${emo(c, "bell")} <b>${esc(L.supportTitle)}</b>`
  const body = tickets.length
    ? tickets
        .slice(0, 20)
        .map((tk) => `• <b>${esc(tk.subject)}</b> — ${esc(ticketStatusLabel(L, tk.status))}`)
        .join("\n")
    : esc(L.supportEmpty)
  const items: ListItem[] = tickets.slice(0, 20).map((tk) => ({
    id: tk.publicId,
    label: `${tk.subject} · ${ticketStatusLabel(L, tk.status)}`.slice(0, 60),
  }))
  await renderCanvas(chatId, {
    photo: BANNER_PATH,
    caption: `${header}\n\n${body}`,
    markup: supportKeyboard(c, items, locale),
    editId,
  })
}

/** A single support ticket thread with reply/close actions. */
async function showTicketThread(chatId: number, user: User, publicId: string, editId?: number) {
  const c = await cfg()
  const locale = localeOf(c, user)
  const L = secLabels(locale)
  let tk: Awaited<ReturnType<typeof getTicket>>
  try {
    tk = await getTicket(user.id, publicId)
  } catch {
    await sendMessage(chatId, `${emo(c, "cross")} ${esc(L.ticketNotFound)}`)
    return
  }
  const closed = tk.status === "CLOSED"
  const head = `${emo(c, "bell")} <b>${esc(tk.subject)}</b> — ${esc(ticketStatusLabel(L, tk.status))}`
  const msgs = tk.messages
    .slice(-8)
    .map((m) => `${m.fromStaff ? "🛡️" : "👤"} ${esc(m.body)}`)
    .join("\n\n")
  await renderCanvas(chatId, {
    photo: BANNER_PATH,
    caption: `${head}\n\n${msgs}`,
    markup: ticketThreadKeyboard(c, tk.publicId, closed, locale),
    editId,
  })
}

/** Create the deposit request for a chosen method and show pay instructions. */
async function startDepositForMethod(
  chatId: number,
  user: User,
  locale: Locale,
  method: BotPayMethod,
  amount: bigint,
) {
  const c = await cfg()
  const L = secLabels(locale)
  try {
    if (method === "STARS") {
      if (!botConfigured()) throw new Error(L.methodUnavailable)
      const dep = await createDepositRequest({ userId: user.id, amount, method: "STARS" })
      await prisma.depositRequest.update({ where: { id: dep.id }, data: { starsPayload: dep.publicId } })
      await sendInvoice({
        chatId,
        title: L.starsInvoiceTitle,
        description: `${L.starsInvoiceDesc} ${formatToman(amount)} ${L.toman}`.slice(0, 255),
        payload: dep.publicId,
        stars: Number(dep.payAmount),
      })
      return
    }
    const dep = await createDepositRequest({ userId: user.id, amount, method })
    const amountStr =
      dep.payCurrency === "IRT"
        ? `${fa(dep.payAmount)} ${L.toman}`
        : `${(Number(dep.payAmount) / 100).toLocaleString(localeTag(locale), {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} ${dep.payCurrency}`
    const lines = [
      `${emo(c, "card")} <b>${esc(L.depInstrTitle)}</b>`,
      "",
      `${emo(c, "money")} ${esc(L.depAmount)}: <b>${esc(amountStr)}</b>`,
    ]
    if (dep.payAddress) lines.push(`${esc(L.depAddress)}: <code>${esc(dep.payAddress)}</code>`)
    if (dep.payNetwork) lines.push(`${esc(L.depNetwork)}: ${esc(dep.payNetwork)}`)
    if (dep.payTag) lines.push(`${esc(L.depTag)}: <code>${esc(dep.payTag)}</code>`)
    lines.push("", `${emo(c, "warning")} ${esc(L.depNote)}`)
    await sendMessage(chatId, lines.join("\n"), {
      replyMarkup: depositInstructionsKeyboard(c, dep.id, locale),
    })
  } catch (e) {
    await sendMessage(chatId, `${emo(c, "cross")} ${esc((e as Error).message)}`)
  }
}

/** Persist an uploaded receipt photo to Blob and mark the deposit as claimed. */
async function handleReceiptPhoto(
  chatId: number,
  user: User,
  pending: PendingAction,
  photos: TgPhotoSize[],
) {
  const c = await cfg()
  const locale = localeOf(c, user)
  const L = secLabels(locale)
  if (pending.kind !== "awaiting_deposit_receipt") return
  const best = photos[photos.length - 1]
  try {
    const file = await getFile(best.file_id)
    if (!file.file_path) throw new Error("file")
    const buf = await downloadTelegramFile(file.file_path)
    const ext = (file.file_path.split(".").pop() || "jpg").toLowerCase()
    const blob = await put(`receipts/${pending.depositId}-${Date.now()}.${ext}`, buf, {
      access: "public",
      contentType: "image/jpeg",
    })
    await claimDepositPaid(pending.depositId, user.id, blob.url)
    await clearPending(chatId)
    await sendMessage(chatId, `${emo(c, "check")} ${esc(L.receiptSaved)}`, {
      replyMarkup: mainMenu(c, locale),
    })
  } catch (e) {
    await sendMessage(chatId, `${emo(c, "cross")} ${esc((e as Error).message)}`)
  }
}

/** Validate + place a bid entered in chat, then refresh the auction card. */
async function handleBidInput(
  chatId: number,
  user: User,
  locale: Locale,
  auctionId: string,
  text: string,
) {
  const c = await cfg()
  const L = secLabels(locale)
  const amount = parseAmount(text)
  if (amount == null) {
    await sendMessage(chatId, `${emo(c, "warning")} ${esc(L.bidInvalid)}`)
    return
  }
  await clearPending(chatId)
  try {
    await placeBid({ userId: user.id, auctionId, amount })
    await sendMessage(chatId, `${emo(c, "check")} ${esc(L.bidPlaced)}`)
    await showAuctionDetail(chatId, user, auctionId, 0)
  } catch (e) {
    await sendMessage(chatId, `${emo(c, "cross")} ${esc((e as Error).message)}`, {
      replyMarkup: mainMenu(c, locale),
    })
  }
}

/** A coupon code entered for a product: carry it into the quantity step. */
async function handleCouponInput(
  chatId: number,
  user: User,
  locale: Locale,
  productId: string | undefined,
  text: string,
) {
  const c = await cfg()
  const L = secLabels(locale)
  const code = text.trim()
  await clearPending(chatId)
  if (!productId) {
    await sendMessage(chatId, `${emo(c, "warning")} ${esc(L.couponNoProduct)}`, {
      replyMarkup: mainMenu(c, locale),
    })
    return
  }
  const product = await getFlashProduct(productId)
  if (!product || product.stock < 1) {
    const { html } = t(c, locale, "flashEmpty")
    await sendMessage(chatId, html, { replyMarkup: mainMenu(c, locale) })
    return
  }
  // Light validation against the single-unit subtotal (re-checked at purchase).
  try {
    await evaluateCoupon(prisma, code, product.price, user.id)
  } catch {
    await sendMessage(chatId, `${emo(c, "cross")} ${esc(L.couponInvalid)}`)
    return
  }
  await setPending(chatId, { kind: "awaiting_quantity", productId, couponCode: code })
  const bulk =
    product.bulkMinQty && product.bulkDiscountPercent
      ? bulkNote(locale, product.bulkDiscountPercent, product.bulkMinQty)
      : ""
  const { html } = t(c, locale, "quantityPrompt", {
    title: product.title,
    price: price(c, locale, product.price),
    stock: product.stock,
    bulk,
    min: 1,
    max: product.stock,
  })
  await sendMessage(chatId, `${emo(c, "check")} ${esc(L.couponOk)}\n\n${html}`)
}

/** First step of a new ticket: capture the subject, then ask for the message. */
async function handleSupportSubject(chatId: number, user: User, locale: Locale, text: string) {
  const c = await cfg()
  const L = secLabels(locale)
  const subject = text.trim()
  if (subject.length < 3) {
    await sendMessage(chatId, `${emo(c, "warning")} ${esc(L.subjectShort)}`)
    return
  }
  await setPending(chatId, { kind: "awaiting_support_message", subject })
  await sendMessage(chatId, `${emo(c, "point")} ${esc(L.messagePrompt)}`)
}

/** Second step of a new ticket: create it with the initial message. */
async function handleSupportMessage(
  chatId: number,
  user: User,
  locale: Locale,
  subject: string,
  text: string,
) {
  const c = await cfg()
  const L = secLabels(locale)
  await clearPending(chatId)
  try {
    const ticket = await createTicket({ userId: user.id, subject, message: text.trim() })
    await sendMessage(chatId, `${emo(c, "check")} ${esc(L.ticketCreated)} <code>${esc(ticket.publicId)}</code>`)
    await showTicketThread(chatId, user, ticket.publicId)
  } catch (e) {
    await sendMessage(chatId, `${emo(c, "cross")} ${esc((e as Error).message)}`)
  }
}

/** Post a reply to an existing ticket, then refresh the thread. */
async function handleTicketReply(
  chatId: number,
  user: User,
  locale: Locale,
  ticketId: string,
  text: string,
) {
  const c = await cfg()
  const L = secLabels(locale)
  await clearPending(chatId)
  try {
    await replyToTicket({ userId: user.id, publicId: ticketId, message: text.trim() })
    await sendMessage(chatId, `${emo(c, "check")} ${esc(L.ticketReplied)}`)
    await showTicketThread(chatId, user, ticketId)
  } catch (e) {
    await sendMessage(chatId, `${emo(c, "cross")} ${esc((e as Error).message)}`)
  }
}

async function handleCallback(cb: TgCallback) {
  const c = await cfg()
  const chatId = cb.message?.chat.id
  const messageId = cb.message?.message_id
  const data = cb.data || ""
  if (!chatId) {
    await answerCallbackQuery(cb.id)
    return
  }

  // Maintenance mode: block non-admins from any button action too.
  if (await maintenanceBlock(cb.from.id, chatId)) {
    await answerCallbackQuery(cb.id)
    return
  }

  const user = await findUser(cb.from.id)
  if (!user) {
    await answerCallbackQuery(cb.id, "/start", true)
    return
  }
  const locale = localeOf(c, user)

  // Forced-join "verify membership" button: re-check and unlock or re-prompt.
  if (data === "join:check") {
    await clearMembershipCache(cb.from.id)
    const access = await checkMemberships(c, cb.from.id, { force: true })
    if (access.ok) {
      // Forced-join gate cleared → onboarding complete, settle the inviter's
      // "friend joined" reward (idempotent).
      await completeReferralJoin(user)
      await answerCallbackQuery(cb.id, plain(t(c, locale, "joinVerified").html).slice(0, 190))
      const { html } = t(c, locale, "joinVerified", { brand: c.brandName })
      if (messageId) await editMessageText(chatId, messageId, html, { replyMarkup: mainMenu(c, locale) })
      else await sendMessage(chatId, html, { replyMarkup: mainMenu(c, locale) })
    } else {
      await answerCallbackQuery(cb.id, plain(t(c, locale, "joinNotYet").html).slice(0, 190), true)
      await showJoinGate(chatId, locale, access.missing, true, messageId)
    }
    return
  }

  // Language selection is allowed before joining (onboarding step 1). Every
  // other action passes through the forced-join guard first.
  const bypassGate = data.startsWith("lang:") || data.startsWith("join:")
  if (!bypassGate && !(await ensureAccess(chatId, user, locale))) {
    await answerCallbackQuery(cb.id)
    return
  }

  // Buy flow: start quantity entry.
  if (data.startsWith("buy:")) {
    await answerCallbackQuery(cb.id)
    const productId = data.slice(4)
    await startBuy(chatId, user, locale, productId)
    return
  }

  // Payment selection: pay:<method>:<productId>:<qty>
  if (data.startsWith("pay:")) {
    const [, method, productId, qtyStr] = data.split(":")
    const qty = Number(qtyStr) || 1
    await answerCallbackQuery(cb.id)
    if (method === "wallet") {
      await completeWalletPurchase(chatId, user, locale, productId, qty)
    } else {
      const { html } = t(c, locale, "paymentComingSoon")
      await sendMessage(chatId, html, { replyMarkup: mainMenu(c, locale) })
    }
    return
  }

  // Canvas list → item detail: open:<section>:<id>
  if (data.startsWith("open:")) {
    const [, section, id] = data.split(":")
    await answerCallbackQuery(cb.id)
    if (section === "flash") return showFlashDetail(chatId, locale, id, 0, messageId)
    if (section === "auc") return showAuctionDetail(chatId, user, id, 0, messageId)
    return
  }

  // Canvas list pagination: page:<section>:<n>
  if (data.startsWith("page:")) {
    const [, section, nStr] = data.split(":")
    const page = Math.max(0, Number(nStr) || 0)
    await answerCallbackQuery(cb.id)
    if (section === "flash") return showFlash(chatId, locale, messageId, page)
    if (section === "auc") return showAuctions(chatId, locale, messageId, page)
    if (section === "notif") return showNotifications(chatId, user, messageId, page)
    return
  }

  // Apply a coupon to a flash product: coupon:<productId>
  if (data.startsWith("coupon:")) {
    const productId = data.slice(7)
    await setPending(chatId, { kind: "awaiting_coupon_code", productId })
    await answerCallbackQuery(cb.id)
    const L = secLabels(locale)
    await sendMessage(chatId, `${emo(c, "point")} ${esc(L.couponApplied)}:`)
    return
  }

  // Place a bid: bid:<auctionId>:<page>
  if (data.startsWith("bid:")) {
    const [, auctionId] = data.split(":")
    await setPending(chatId, { kind: "awaiting_bid_amount", auctionId })
    await answerCallbackQuery(cb.id)
    const L = secLabels(locale)
    const a = await getAuctionDetail(auctionId).catch(() => null)
    const minLine = a ? ` <b>${esc(price(c, locale, a.minNextBid))}</b>` : ""
    await sendMessage(chatId, `${emo(c, "chart")} ${esc(L.bidPrompt)}${minLine}`)
    return
  }

  // Buy-now on an auction: abuy:<auctionId>:<page>
  if (data.startsWith("abuy:")) {
    const [, auctionId] = data.split(":")
    const L = secLabels(locale)
    try {
      await buyNow({ userId: user.id, auctionId })
      await answerCallbackQuery(cb.id, L.buyNowDone, true)
      await sendMessage(chatId, `${emo(c, "check")} ${esc(L.buyNowDone)}`, { replyMarkup: mainMenu(c, locale) })
    } catch (e) {
      await answerCallbackQuery(cb.id, (e as Error).message.slice(0, 190), true)
    }
    return
  }

  // Toggle watchlist: watch:<auctionId>:<page>
  if (data.startsWith("watch:")) {
    const [, auctionId, pageStr] = data.split(":")
    const page = Math.max(0, Number(pageStr) || 0)
    const L = secLabels(locale)
    const watching = await isWatching(user.id, auctionId).catch(() => false)
    if (watching) await removeFromWatchlist(user.id, auctionId)
    else await addToWatchlist(user.id, auctionId)
    await answerCallbackQuery(cb.id, watching ? L.watchOff : L.watchOn)
    await showAuctionDetail(chatId, user, auctionId, page, messageId)
    return
  }

  // Deposit method chosen: dep:<method> → ask for the amount.
  if (data.startsWith("dep:")) {
    const method = data.slice(4) as BotPayMethod
    await setPending(chatId, { kind: "awaiting_deposit_amount", method })
    await answerCallbackQuery(cb.id)
    const { html } = t(c, locale, "depositPrompt")
    await sendMessage(chatId, html)
    return
  }

  // Mark a deposit as paid: deppaid:<depositId>
  if (data.startsWith("deppaid:")) {
    const depositId = data.slice(8)
    const L = secLabels(locale)
    try {
      await claimDepositPaid(depositId, user.id)
      await answerCallbackQuery(cb.id, L.paidClaimedShort, true)
      await sendMessage(chatId, `${emo(c, "check")} ${esc(L.paidClaimed)}`, { replyMarkup: mainMenu(c, locale) })
    } catch (e) {
      await answerCallbackQuery(cb.id, (e as Error).message.slice(0, 190), true)
    }
    return
  }

  // Upload a receipt for a deposit: deprcpt:<depositId>
  if (data.startsWith("deprcpt:")) {
    const depositId = data.slice(8)
    await setPending(chatId, { kind: "awaiting_deposit_receipt", depositId })
    await answerCallbackQuery(cb.id)
    const L = secLabels(locale)
    await sendMessage(chatId, `${emo(c, "point")} ${esc(L.receiptPrompt)}`)
    return
  }

  // Per-order payment: opay:<method>:<productId>:<qty>
  if (data.startsWith("opay:")) {
    const [, method, productId, qtyStr] = data.split(":")
    const qty = Number(qtyStr) || 1
    await answerCallbackQuery(cb.id)
    const draft = await getOrderDraft(chatId)
    const couponCode = draft?.couponCode
    if (method === "WALLET") {
      await completeWalletPurchase(chatId, user, locale, productId, qty, couponCode)
    } else {
      const { html } = t(c, locale, "paymentComingSoon")
      await sendMessage(chatId, html, { replyMarkup: mainMenu(c, locale) })
    }
    return
  }

  // Open a notification (mark read): nopen:<id>
  if (data.startsWith("nopen:")) {
    const id = data.slice(6)
    await markRead(user.id, id).catch(() => {})
    await answerCallbackQuery(cb.id)
    await showNotifications(chatId, user, messageId)
    return
  }
  if (data === "nallread") {
    await markAllRead(user.id).catch(() => {})
    const L = secLabels(locale)
    await answerCallbackQuery(cb.id, L.allRead)
    await showNotifications(chatId, user, messageId)
    return
  }

  // Claim a completed mission reward: mclaim:<missionId>
  if (data.startsWith("mclaim:")) {
    const missionId = data.slice(7)
    const L = secLabels(locale)
    const res = await claimMission(user.id, missionId).catch(() => ({ ok: false, points: 0 }))
    await answerCallbackQuery(cb.id, res.ok ? `${L.claimedOk} +${res.points}` : L.claimFail, true)
    await showRewards(chatId, user, messageId)
    return
  }

  // Support: new ticket / open thread / reply / close.
  if (data === "tnew") {
    await setPending(chatId, { kind: "awaiting_support_subject" })
    await answerCallbackQuery(cb.id)
    const L = secLabels(locale)
    await sendMessage(chatId, `${emo(c, "point")} ${esc(L.subjectPrompt)}`)
    return
  }
  if (data.startsWith("topen:")) {
    const publicId = data.slice(6)
    await answerCallbackQuery(cb.id)
    await showTicketThread(chatId, user, publicId, messageId)
    return
  }
  if (data.startsWith("treply:")) {
    const ticketId = data.slice(7)
    await setPending(chatId, { kind: "awaiting_ticket_reply", ticketId })
    await answerCallbackQuery(cb.id)
    const L = secLabels(locale)
    await sendMessage(chatId, `${emo(c, "point")} ${esc(L.messagePrompt)}`)
    return
  }
  if (data.startsWith("tclose:")) {
    const publicId = data.slice(7)
    await closeTicket(user.id, publicId).catch(() => {})
    await answerCallbackQuery(cb.id)
    await showTicketThread(chatId, user, publicId, messageId)
    return
  }

  // Language selection: lang:<locale>
  if (data.startsWith("lang:")) {
    const next = data.slice(5)
    await answerCallbackQuery(cb.id)
    await setLanguage(chatId, user, messageId, next)
    return
  }

  if (data.startsWith("wallet:")) {
    const action = data.slice(7)
    if (action === "deposit") {
      await answerCallbackQuery(cb.id)
      const methods = await enabledPayMethods()
      if (methods.length === 0) {
        const { html } = t(c, locale, "paymentComingSoon")
        await sendMessage(chatId, html, { replyMarkup: walletMenu(c, locale) })
        return
      }
      const L = secLabels(locale)
      await sendMessage(chatId, `${emo(c, "card")} ${esc(L.depositChoose)}`, {
        replyMarkup: depositMethodKeyboard(c, methods, locale),
      })
      return
    }
    if (action === "withdraw") {
      await setPending(chatId, { kind: "awaiting_withdraw_amount" })
      const { html } = t(c, locale, "withdrawPrompt")
      await answerCallbackQuery(cb.id)
      await sendMessage(chatId, html)
      return
    }
  }

  if (data.startsWith("menu:")) {
    const view = data.slice(5)
    await answerCallbackQuery(cb.id)
    switch (view) {
      case "home":
        return showHome(chatId, user, { edit: messageId })
      case "wallet":
        return showWallet(chatId, user, messageId)
      case "orders":
        return showOrders(chatId, user, messageId)
      case "flash":
        return showFlash(chatId, locale, messageId)
      case "auctions":
        return showAuctions(chatId, locale, messageId)
      case "watchlist":
        return showWatchlist(chatId, user, messageId)
      case "profile":
        return showProfile(chatId, user, messageId)
      case "rewards":
        return showRewards(chatId, user, messageId)
      case "notifications":
        return showNotifications(chatId, user, messageId)
      case "support":
        return showSupport(chatId, user, messageId)
      case "invite":
        return showReferral(chatId, user, messageId)
      case "language":
        return showLanguage(chatId, locale, messageId)
      case "help":
        return showHelp(chatId, locale, messageId)
    }
  }

  // Giveaway entry: gw:enter:<id> | gw:noop:<id>
  if (data.startsWith("gw:")) {
    const [, action, id] = data.split(":")
    const L = gwLabels(locale)
    if (action === "noop") {
      await answerCallbackQuery(cb.id, L.entered)
      return
    }
    if (action === "enter") {
      try {
        const { created } = await enterGiveaway({ giveawayId: id, userId: user.id, source: "BOT" })
        await answerCallbackQuery(cb.id, created ? L.entrySaved : L.entered, true)
        // Refresh the card so the participant count / button state update.
        const g = await prisma.giveaway.findUnique({ where: { id }, select: { slug: true } })
        if (g) await showGiveawayCard(chatId, user, g.slug)
      } catch (e) {
        if (e instanceof MembershipRequiredError) {
          await answerCallbackQuery(cb.id, L.joinNeeded, true)
          await sendMessage(chatId, `📢 ${esc(L.join)}`, {
            replyMarkup: giveawayJoinKeyboard(id, e.missing, L.retry),
          })
        } else {
          await answerCallbackQuery(cb.id, (e as Error).message.slice(0, 190), true)
        }
      }
      return
    }
  }

  // Admin pre-draw control panel: gwdraw:start|delay|cancel:<id>
  if (data.startsWith("gwdraw:")) {
    const [, action, id] = data.split(":")
    if (user.role !== "ADMIN") {
      await answerCallbackQuery(cb.id, "⛔", true)
      return
    }
    try {
      if (action === "start") {
        const res = await drawGiveaway(id, { actorId: user.id })
        await answerCallbackQuery(cb.id, `🎲 ${res.winners.length} 🏆`, true)
        if (messageId) {
          await editMessageText(
            chatId,
            messageId,
            `✅ <b>قرعه‌کشی انجام شد</b>\n🏆 ${res.winners.length} برنده انتخاب و جوایز ارسال شد.`,
          )
        }
      } else if (action === "delay") {
        await setGiveawayLifecycle(id, "delay", { actorId: user.id, minutes: 30 })
        await answerCallbackQuery(cb.id, "⏳ +۳۰ دقیقه", true)
        if (messageId) await editMessageText(chatId, messageId, "⏳ <b>قرعه‌کشی ۳۰ دقیقه به تعویق افتاد.</b>")
      } else if (action === "cancel") {
        await setGiveawayLifecycle(id, "cancel", { actorId: user.id })
        await answerCallbackQuery(cb.id, "✖️", true)
        if (messageId) await editMessageText(chatId, messageId, "✖️ <b>قرعه‌کشی لغو شد.</b>")
      }
    } catch (e) {
      await answerCallbackQuery(cb.id, (e as Error).message.slice(0, 190), true)
    }
    return
  }

  await answerCallbackQuery(cb.id)
}

/** Begin the interactive buy: ask for the quantity. */
async function startBuy(chatId: number, user: User, locale: Locale, productId: string) {
  const c = await cfg()
  const product = await getFlashProduct(productId)
  if (!product || product.stock < 1) {
    const { html } = t(c, locale, "flashEmpty")
    await sendMessage(chatId, html, { replyMarkup: mainMenu(c, locale) })
    return
  }
  await setPending(chatId, { kind: "awaiting_quantity", productId })
  const bulk =
    product.bulkMinQty && product.bulkDiscountPercent
      ? bulkNote(locale, product.bulkDiscountPercent, product.bulkMinQty)
      : ""
  const { html } = t(c, locale, "quantityPrompt", {
    title: product.title,
    price: price(c, locale, product.price),
    stock: product.stock,
    bulk,
    min: 1,
    max: product.stock,
  })
  await sendMessage(chatId, html)
}

/** Settle a wallet purchase, showing an insufficient-balance card if needed. */
async function completeWalletPurchase(
  chatId: number,
  user: User,
  locale: Locale,
  productId: string,
  qty: number,
  couponCode?: string,
) {
  const c = await cfg()
  const product = await getFlashProduct(productId)
  if (!product || product.stock < qty) {
    const { html } = t(c, locale, "flashEmpty")
    await sendMessage(chatId, html, { replyMarkup: mainMenu(c, locale) })
    return
  }
  const { totalPrice } = priceFor(product, qty)
  // Preview the payable total (coupon-adjusted) purely for the balance check.
  let payable = totalPrice
  if (couponCode) {
    try {
      const { preview } = await evaluateCoupon(prisma, couponCode, totalPrice, user.id)
      payable = preview.finalTotal
    } catch {
      /* invalid coupon at this subtotal — purchaseFixed will re-validate */
    }
  }
  const balances = await getBalances(user.id)
  if (balances.availableBalance < payable) {
    const { html } = t(c, locale, "insufficientBalance", {
      balance: price(c, locale, balances.availableBalance),
      required: price(c, locale, payable),
    })
    await sendMessage(chatId, html, { replyMarkup: walletMenu(c, locale) })
    return
  }
  try {
    const order = await purchaseFixed({ userId: user.id, productId, quantity: qty, couponCode })
    await clearOrderDraft(chatId)
    const { html } = t(c, locale, "purchaseSuccess", {
      title: `${product.title} ×${qty}`,
      price: price(c, locale, order.amount),
    })
    await sendMessage(chatId, html, { replyMarkup: mainMenu(c, locale) })
  } catch (e) {
    const { html } = t(c, locale, "purchaseFailed", { reason: (e as Error).message })
    await sendMessage(chatId, html, { replyMarkup: mainMenu(c, locale) })
  }
}

/**
 * Persist a manual language choice, then continue the onboarding flow in that
 * language: confirm → forced-join gate (if needed) → welcome/main menu. Used
 * both for the first-run picker and the in-menu language switch.
 */
async function setLanguage(chatId: number, user: User, messageId: number | undefined, next: string) {
  const c = await cfg()
  const locale = tgLangToLocale(next)
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { languageCode: locale, localeManual: true },
  })
  const confirm = t(c, locale, "languageSet")
  // Replace the picker with the confirmation (buttons added by the next step).
  if (messageId) await editMessageText(chatId, messageId, confirm.html)
  else await sendMessage(chatId, confirm.html)

  // Forced-join gate before granting access to the main menu.
  if (forcedJoinActive(c) && user.telegramId) {
    const access = await checkMemberships(c, user.telegramId, { force: true })
    if (!access.ok) {
      await showJoinGate(chatId, locale, access.missing, false)
      return
    }
  }
  // Onboarding complete (language chosen + gate passed) → settle stage-A reward.
  await completeReferralJoin(updated)
  await showWelcome(chatId, updated, false)
}

/** Approve a Stars pre-checkout (we already reserved the deposit on invoice). */
async function handlePreCheckout(q: TgPreCheckout) {
  // Only accept payloads we actually issued; otherwise decline cleanly.
  const exists = await prisma.depositRequest.findFirst({
    where: { starsPayload: q.invoice_payload, method: "STARS" },
    select: { id: true },
  })
  await answerPreCheckoutQuery(q.id, !!exists, "این فاکتور معتبر نیست").catch(() => {})
}

/** Credit the wallet once Telegram confirms the Stars payment succeeded. */
async function handleSuccessfulPayment(msg: TgMessage) {
  const sp = msg.successful_payment
  if (!sp) return
  try {
    await approveStarsDeposit(sp.invoice_payload, sp.telegram_payment_charge_id)
    await sendMessage(msg.chat.id, "✅ پرداخت با استارز با موفقیت انجام شد و موجودی کیف پول شما افزایش یافت.")
  } catch (e) {
    console.log("[v0] stars payment credit error:", (e as Error).message)
  }
}

/** Top-level dispatch with error isolation so the webhook always 200s. */
export async function handleUpdate(update: TgUpdate) {
  try {
    if (update.pre_checkout_query) await handlePreCheckout(update.pre_checkout_query)
    else if (update.message?.successful_payment) await handleSuccessfulPayment(update.message)
    else if (update.message) await handleMessage(update.message)
    else if (update.callback_query) await handleCallback(update.callback_query)
  } catch (e) {
    console.log("[v0] bot handleUpdate error:", (e as Error).message)
  }
}
