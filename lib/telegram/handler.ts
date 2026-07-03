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
import { setPending, getPending, clearPending, setCanvas, getCanvas, type PendingAction, type BotPayMethod } from "./state"
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
import { createDepositRequest, createWithdrawalRequest, approveStarsDeposit } from "@/lib/core/finance"
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
        await sendProductCard(chatId, locale, product)
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

  // Pending conversation flows (deposit/withdraw/quantity entry).
  const pending = await getPending(chatId)
  if (pending && !text.startsWith("/")) {
    await handlePendingInput(chatId, user, pending, text)
    return
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
  pending: { kind: string; productId?: string },
  text: string,
) {
  const c = await cfg()
  const locale = localeOf(c, user)

  // Quantity entry for the interactive buy flow.
  if (pending.kind === "awaiting_quantity") {
    await handleQuantityInput(chatId, user, locale, pending.productId!, text)
    return
  }

  const amount = parseAmount(text)
  if (amount == null) {
    await sendMessage(chatId, `${emo(c, "warning")} 500000`)
    return
  }
  await clearPending(chatId)
  try {
    if (pending.kind === "awaiting_deposit_amount") {
      await createDepositRequest({ userId: user.id, amount, note: "Telegram bot" })
      const { html } = t(c, locale, "depositReceived", { amount: fa(amount) })
      await sendMessage(chatId, html, { replyMarkup: mainMenu(c, locale) })
    } else if (pending.kind === "awaiting_withdraw_amount") {
      await createWithdrawalRequest({ userId: user.id, amount, note: "Telegram bot" })
      const { html } = t(c, locale, "withdrawReceived", { amount: fa(amount) })
      await sendMessage(chatId, html, { replyMarkup: mainMenu(c, locale) })
    }
  } catch (e) {
    await sendMessage(chatId, `${emo(c, "cross")} ${esc((e as Error).message)}`)
  }
}

/** Validate the quantity, then present the payment-method keyboard. */
async function handleQuantityInput(
  chatId: number,
  user: User,
  locale: Locale,
  productId: string,
  text: string,
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
  const { totalPrice } = priceFor(product, qty)
  const { html } = t(c, locale, "selectPayment", {
    orderTitle: `${product.title} ×${qty}`,
    total: price(c, locale, totalPrice),
  })
  await sendMessage(chatId, html, { replyMarkup: paymentKeyboard(c, productId, qty, locale) })
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
      await setPending(chatId, { kind: "awaiting_deposit_amount" })
      const { html } = t(c, locale, "depositPrompt")
      await answerCallbackQuery(cb.id)
      await sendMessage(chatId, html)
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
) {
  const c = await cfg()
  const product = await getFlashProduct(productId)
  if (!product || product.stock < qty) {
    const { html } = t(c, locale, "flashEmpty")
    await sendMessage(chatId, html, { replyMarkup: mainMenu(c, locale) })
    return
  }
  const { totalPrice } = priceFor(product, qty)
  const balances = await getBalances(user.id)
  if (balances.availableBalance < totalPrice) {
    const { html } = t(c, locale, "insufficientBalance", {
      balance: price(c, locale, balances.availableBalance),
      required: price(c, locale, totalPrice),
    })
    await sendMessage(chatId, html, { replyMarkup: walletMenu(c, locale) })
    return
  }
  try {
    const order = await purchaseFixed({ userId: user.id, productId, quantity: qty })
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
