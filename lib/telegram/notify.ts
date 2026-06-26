import "server-only"
import { prisma } from "@/lib/db"
import { getBotConfig } from "./settings"
import { render } from "./format"
import { sendMessage, sendPhoto, botConfigured, inlineKeyboard } from "./api"
import { auctionButton, openAppKeyboard } from "./keyboards"
import { formatToman } from "@/lib/format"
import type { BotTextKey } from "./config"

/**
 * Best-effort push notification helpers. They never throw: a notification
 * failure must never break a core transaction (settlement, delivery, payout).
 */

async function chatIdFor(userId: string): Promise<string | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramChatId: true, telegramId: true },
  })
  return u?.telegramChatId || u?.telegramId || null
}

async function notify(
  userId: string,
  textKey: BotTextKey,
  vars: Record<string, string | number>,
  opts: { photo?: string | null; replyMarkup?: object } = {},
) {
  try {
    if (!botConfigured()) return
    const chatId = await chatIdFor(userId)
    if (!chatId) return
    const cfg = await getBotConfig()
    if (!cfg.features.notifications) return
    const { html } = render(cfg.texts[textKey], cfg, vars)
    if (opts.photo) {
      await sendPhoto(chatId, opts.photo, html, { replyMarkup: opts.replyMarkup }).catch(
        () => sendMessage(chatId, html, { replyMarkup: opts.replyMarkup }),
      )
    } else {
      await sendMessage(chatId, html, { replyMarkup: opts.replyMarkup })
    }
  } catch (e) {
    console.log("[v0] notify error:", (e as Error).message)
  }
}

export async function notifyAuctionWon(userId: string, title: string, price: bigint, photo?: string | null) {
  await notify(userId, "notifAuctionWon", { title, price: formatToman(price) }, { photo })
}

export async function notifyOrderDelivered(userId: string, title: string, photo?: string | null) {
  await notify(userId, "notifOrderDelivered", { title }, { photo })
}

export async function notifyDepositApproved(userId: string, amount: bigint) {
  await notify(userId, "notifDepositApproved", { amount: formatToman(amount) })
}

export async function notifyWithdrawApproved(userId: string, amount: bigint) {
  await notify(userId, "notifWithdrawApproved", { amount: formatToman(amount) })
}

/** Stage A — tell the inviter their friend joined the bot (and passed the gate). */
export async function notifyReferralJoined(referrerId: string, friendName: string, bonus: bigint) {
  await notify(referrerId, "notifReferralJoined", {
    name: friendName,
    bonus: formatToman(bonus),
  })
}

/** Stage B — tell the inviter their friend made a first purchase (big bonus). */
export async function notifyReferralPurchase(referrerId: string, friendName: string, bonus: bigint) {
  await notify(referrerId, "notifReferralPurchase", {
    name: friendName,
    bonus: formatToman(bonus),
  })
}

/** Stage C — tell the inviter they earned lifetime commission on a friend's buy. */
export async function notifyReferralCommission(referrerId: string, friendName: string, amount: bigint) {
  await notify(referrerId, "notifReferralCommission", {
    name: friendName,
    amount: formatToman(amount),
  })
}

/** Notify a single watcher that a flash product they follow is back in stock. */
export async function notifyBackInStock(
  userId: string,
  title: string,
  productId: string,
  photo?: string | null,
) {
  try {
    if (!botConfigured()) return
    const chatId = await chatIdFor(userId)
    if (!chatId) return
    const cfg = await getBotConfig()
    if (!cfg.features.notifications) return
    const html = `🔔 <b>${title}</b>\nمحصول دوباره موجود شد! برای خرید عجله کنید.`
    const markup = openAppKeyboard(cfg, `/flash/${productId}`)
    if (photo) {
      await sendPhoto(chatId, photo, html, { replyMarkup: markup }).catch(() =>
        sendMessage(chatId, html, { replyMarkup: markup }),
      )
    } else {
      await sendMessage(chatId, html, { replyMarkup: markup })
    }
  } catch (e) {
    console.log("[v0] notifyBackInStock error:", (e as Error).message)
  }
}

/**
 * Premium winner notification: congratulate the user and deep-link them to the
 * giveaway page (where they see claim instructions). Best-effort.
 */
export async function notifyGiveawayWon(
  userId: string,
  title: string,
  prizeLabel: string,
  slug: string,
  photo?: string | null,
) {
  try {
    if (!botConfigured()) return
    const chatId = await chatIdFor(userId)
    if (!chatId) return
    const cfg = await getBotConfig()
    if (!cfg.features.notifications) return
    const html =
      `🎉🏆 <b>تبریک! شما برنده شدید</b> 🏆🎉\n\n` +
      `در قرعه‌کشی «<b>${title}</b>» برنده‌ی زیر شدید:\n` +
      `🎁 <b>${prizeLabel}</b>\n\n` +
      `برای مشاهده‌ی جزئیات و دریافت جایزه روی دکمه‌ی زیر بزنید.`
    const markup = openAppKeyboard(cfg, `/giveaways/${slug}`)
    if (photo) {
      await sendPhoto(chatId, photo, html, { replyMarkup: markup }).catch(() =>
        sendMessage(chatId, html, { replyMarkup: markup }),
      )
    } else {
      await sendMessage(chatId, html, { replyMarkup: markup })
    }
  } catch (e) {
    console.log("[v0] notifyGiveawayWon error:", (e as Error).message)
  }
}

/**
 * Pre-draw admin approval alert (~5 min before draw): sends every admin with a
 * linked Telegram the participant breakdown plus Start / Delay / Cancel action
 * buttons. The draw never runs automatically without approval (unless autoDraw).
 */
export async function notifyAdminsPreDraw(giveawayId: string) {
  try {
    if (!botConfigured()) return
    const cfg = await getBotConfig()
    const { prisma } = await import("@/lib/db")
    const g = await prisma.giveaway.findUnique({ where: { id: giveawayId } })
    if (!g) return
    const [total, eligible, winnersWanted] = await Promise.all([
      prisma.giveawayEntry.count({ where: { giveawayId } }),
      prisma.giveawayEntry.count({ where: { giveawayId, eligible: true } }),
      Promise.resolve(g.winnersCount),
    ])
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", OR: [{ telegramChatId: { not: null } }, { telegramId: { not: null } }] },
      select: { id: true },
    })
    if (admins.length === 0) return
    const html =
      `⏰ <b>قرعه‌کشی آماده‌ی برگزاری است</b>\n\n` +
      `🎬 «<b>${g.title}</b>»\n` +
      `🎁 جایزه: <b>${g.prizeLabel}</b>\n` +
      `👥 کل شرکت‌کنندگان: <b>${total}</b>\n` +
      `✅ واجد شرایط: <b>${eligible}</b>\n` +
      `🚫 غیرواجد: <b>${total - eligible}</b>\n` +
      `🏆 تعداد برندگان: <b>${winnersWanted}</b>\n\n` +
      `لطفاً یکی از گزینه‌ها را انتخاب کنید:`
    const markup = inlineKeyboard([
      [{ text: "🎲 شروع قرعه‌کشی", callback_data: `gwdraw:start:${giveawayId}`, style: "success" }],
      [
        { text: "⏳ تعویق ۳۰ دقیقه", callback_data: `gwdraw:delay:${giveawayId}` },
        { text: "✖️ لغو", callback_data: `gwdraw:cancel:${giveawayId}`, style: "danger" },
      ],
    ])
    for (const a of admins) {
      const chatId = await chatIdFor(a.id)
      if (chatId) await sendMessage(chatId, html, { replyMarkup: markup }).catch(() => {})
    }
  } catch (e) {
    console.log("[v0] notifyAdminsPreDraw error:", (e as Error).message)
  }
}

/** Notify a single watcher that an auction they follow has started. */
export async function notifyAuctionStarted(
  userId: string,
  auctionId: string,
  title: string,
  price: bigint,
  photo?: string | null,
) {
  try {
    if (!botConfigured()) return
    const chatId = await chatIdFor(userId)
    if (!chatId) return
    const cfg = await getBotConfig()
    if (!cfg.features.notifications) return
    const { html } = render(cfg.texts.notifAuctionStarted, cfg, {
      title,
      price: formatToman(price),
    })
    const markup = auctionButton(cfg, auctionId)
    if (photo) {
      await sendPhoto(chatId, photo, html, { replyMarkup: markup }).catch(() =>
        sendMessage(chatId, html, { replyMarkup: markup }),
      )
    } else {
      await sendMessage(chatId, html, { replyMarkup: markup })
    }
  } catch (e) {
    console.log("[v0] notifyAuctionStarted error:", (e as Error).message)
  }
}
