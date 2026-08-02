import "server-only"
import { prisma } from "@/lib/db"
import { getBotConfig } from "./settings"
import { render, esc } from "./format"
import {
  sendMessage,
  sendPhoto,
  sendPhotoBytes,
  sendRichMessage,
  sendDocument,
  botConfigured,
  inlineKeyboard,
} from "./api"
import { get } from "@vercel/blob"
import { auctionButton, openAppKeyboard } from "./keyboards"
import { adminTelegramIds } from "./user"
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

/**
 * Push an admin's support reply straight into the owner's Telegram chat so the
 * conversation is two-way inside the bot. Deliberately NOT gated behind the
 * `notifications` feature flag or a linked-account check beyond the chat id —
 * a support answer is transactional and must always reach the user, especially
 * a banned user whose only channel is the appeal thread. Best-effort.
 */
export async function notifySupportReply(
  userId: string,
  reply: { subject: string; body: string; isBanAppeal?: boolean; closed?: boolean },
) {
  try {
    if (!botConfigured()) return
    const chatId = await chatIdFor(userId)
    if (!chatId) return
    const safeBody = reply.body.length > 900 ? `${reply.body.slice(0, 900)}…` : reply.body
    const head = reply.isBanAppeal
      ? "🛡 <b>پاسخ پشتیبانی — بررسی مسدودیت</b>"
      : "💬 <b>پاسخ پشتیبانی</b>"
    const footer = reply.closed
      ? "\n\n<i>این گفتگو بسته شد. در صورت نیاز می‌توانید پیام تازه‌ای بفرستید.</i>"
      : "\n\n<i>برای ادامه‌ی گفتگو کافیست پاسخ خود را همین‌جا بنویسید.</i>"
    const html = `${head}\n\n${esc(safeBody)}${footer}`
    await sendMessage(chatId, html).catch(() => {})
  } catch (e) {
    console.log("[v0] notifySupportReply error:", (e as Error).message)
  }
}

/**
 * Alert every admin with a linked Telegram that a banned user submitted (or
 * continued) a ban-appeal message, with a deep link to the admin support page.
 * Best-effort; keeps admins in the loop without polling the dashboard.
 */
export async function notifyAdminsProductQuestion(productTitle: string, preview: string) {
  try {
    if (!botConfigured()) return
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", isTestAccount: false, OR: [{ telegramChatId: { not: null } }, { telegramId: { not: null } }] },
      select: { id: true },
    })
    const snippet = preview.length > 300 ? `${preview.slice(0, 300)}…` : preview
    const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "")
    const html = `<b>پرسش محصول نیازمند بررسی است</b>\n\n<b>${esc(productTitle)}</b>\n«${esc(snippet)}»`
    const markup = base
      ? inlineKeyboard([[{ text: "باز کردن صف پرسش‌ها", url: `${base}/admin/ai/questions` }]])
      : undefined
    for (const admin of admins) {
      const chatId = await chatIdFor(admin.id)
      if (chatId) await sendMessage(chatId, html, { replyMarkup: markup }).catch(() => {})
    }
  } catch (e) {
    console.log("[v0] notifyAdminsProductQuestion error:", (e as Error).message)
  }
}

export async function notifyAdminsBanAppeal(fromUserId: string, publicId: string, preview: string) {
  try {
    if (!botConfigured()) return
    const sender = await prisma.user.findUnique({
      where: { id: fromUserId },
      select: { displayName: true, alias: true, telegramId: true },
    })
    const who = sender?.displayName || sender?.alias || sender?.telegramId || "کاربر"
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", isTestAccount: false, OR: [{ telegramChatId: { not: null } }, { telegramId: { not: null } }] },
      select: { id: true },
    })
    if (admins.length === 0) return
    const snippet = preview.length > 300 ? `${preview.slice(0, 300)}…` : preview
    const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "")
    const html =
      `🚨 <b>درخواست بررسی مسدودیت</b>\n\n` +
      `👤 از: <b>${esc(String(who))}</b>\n` +
      `📝 «${esc(snippet)}»`
    const markup = base
      ? inlineKeyboard([[{ text: "🛠 باز کردن پنل پشتیبانی", url: `${base}/admin/support` }]])
      : undefined
    for (const a of admins) {
      const chatId = await chatIdFor(a.id)
      if (chatId) await sendMessage(chatId, html, { replyMarkup: markup }).catch(() => {})
    }
  } catch (e) {
    console.log("[v0] notifyAdminsBanAppeal error:", (e as Error).message)
  }
}

export async function notifyAuctionWon(userId: string, title: string, price: bigint, photo?: string | null) {
  await notify(userId, "notifAuctionWon", { title, price: formatToman(price) }, { photo })
}

export async function notifyOrderDelivered(userId: string, title: string, photo?: string | null) {
  await notify(userId, "notifOrderDelivered", { title }, { photo })
}

export async function notifyDepositPending(userId: string, amount: bigint) {
  await notify(userId, "notifDepositPending", { amount: formatToman(amount) })
}

/** User-facing labels for each deposit method (matches the web app). */
const DEPOSIT_METHOD_LABEL: Record<string, string> = {
  CARD: "کارت به کارت",
  TON: "کیف پول تون (TON)",
  USDT: "تتر (USDT)",
  STARS: "استارز تلگرام",
}

/**
 * Every admin chat that should receive an operational alert: the permanent
 * built-in owner id(s) (private chat id == telegram id) unioned with every DB
 * admin that has a linked Telegram chat. De-duplicated so an admin who is also
 * a bootstrap owner is only messaged once.
 */
async function adminChatIds(): Promise<string[]> {
  const ids = new Set<string>()
  for (const id of adminTelegramIds()) ids.add(id)
  const admins = await prisma.user.findMany({
    where: {
      role: "ADMIN",
      isTestAccount: false,
      OR: [{ telegramChatId: { not: null } }, { telegramId: { not: null } }],
    },
    select: { telegramChatId: true, telegramId: true },
  })
  for (const a of admins) {
    const cid = a.telegramChatId || a.telegramId
    if (cid) ids.add(cid)
  }
  return [...ids]
}

/**
 * Operational alert pushed to every admin the moment a user submits a top-up
 * request (from the web app OR the bot, for any manual-review method). Mirrors
 * the web app's admin review card: user name / username / numeric id / amount /
 * method + gateway, the receipt screenshot attached inline when present, and
 * Approve / Reject action buttons. Approving credits the wallet; rejecting
 * prompts the admin for a reason that is delivered to the user — exactly the
 * same core flow (`approveDeposit` / `rejectDeposit`) the dashboard uses.
 * Best-effort: a delivery failure must never break the submit transaction.
 */
type ReceiptFile = { bytes: Uint8Array; contentType: string; filename: string; isImage: boolean }

/**
 * Resolve a stored `receiptUrl` to raw bytes so we can push it to Telegram via
 * multipart upload. Receipts are PRIVATE blobs served through our auth-gated
 * `/api/v1/files/...` proxy, so we CANNOT hand Telegram a URL to fetch (it can't
 * authenticate). Instead we read the blob's bytes directly here. Absolute
 * https URLs (legacy/public) are fetched normally. Returns null on any failure
 * so notification delivery degrades gracefully to a text-only card.
 */
async function fetchReceiptFile(receiptUrl: string): Promise<ReceiptFile | null> {
  try {
    let bytes: Uint8Array
    let contentType = "application/octet-stream"
    if (receiptUrl.startsWith("/api/v1/files/")) {
      const pathname = receiptUrl.slice("/api/v1/files/".length)
      if (!pathname || pathname.includes("..")) return null
      let result
      try {
        result = await get(pathname, { access: "private" })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (/private access on a public store/i.test(msg)) result = await get(pathname, { access: "public" })
        else throw err
      }
      if (!result?.stream) return null
      bytes = new Uint8Array(await new Response(result.stream).arrayBuffer())
      contentType = result.blob.contentType || contentType
    } else if (/^https:\/\//.test(receiptUrl)) {
      const res = await fetch(receiptUrl)
      if (!res.ok) return null
      bytes = new Uint8Array(await res.arrayBuffer())
      contentType = res.headers.get("content-type") || contentType
    } else {
      return null
    }
    if (bytes.byteLength === 0) return null
    const isImage = /^image\//i.test(contentType)
    const ext = isImage ? contentType.split("/")[1]?.split(";")[0] || "jpg" : "pdf"
    return { bytes, contentType, filename: `receipt.${ext}`, isImage }
  } catch (e) {
    console.log("[v0] fetchReceiptFile error:", (e as Error).message)
    return null
  }
}

export async function notifyAdminDepositRequest(depositId: string) {
  try {
    if (!botConfigured()) return
    const req = await prisma.depositRequest.findUnique({
      where: { id: depositId },
      include: {
        user: {
          select: { displayName: true, alias: true, telegramUsername: true, telegramId: true },
        },
      },
    })
    if (!req) return
    const u = req.user
    const name = u.displayName || u.alias || "کاربر"
    const username = u.telegramUsername ? `@${u.telegramUsername}` : "—"
    const numericId = u.telegramId || "—"
    const methodLabel = DEPOSIT_METHOD_LABEL[req.method] ?? req.method
    const gatewayParts = [req.payCurrency, req.payNetwork].filter(Boolean) as string[]
    const gateway = gatewayParts.length ? gatewayParts.join(" · ") : methodLabel

    // Native Rich Message table (Bot API 10.1+). The message stays LTR
    // (is_rtl:false) because table cell `align` is interpreted in LTR geometry;
    // the Persian look is produced by column order + per-cell alignment, not by
    // flipping the whole message. Each row: value column FIRST (centered),
    // label column SECOND (right-aligned, "<b>label</b>&nbsp;emoji"). Copyable
    // values (numeric id, amount) go in <code>. `skip_entity_detection` stops
    // Telegram from auto-linkifying the id/username.
    const richRow = (value: string, label: string, emoji: string, copyable = false) => {
      const v = copyable ? `<code>${esc(value)}</code>` : esc(value)
      return (
        `<tr>` +
        `<td align="center" valign="middle">${v}</td>` +
        `<td align="right" valign="middle"><b>${esc(label)}</b>&nbsp;${emoji}</td>` +
        `</tr>`
      )
    }
    const richHtml =
      `<h3>💰 درخواست افزایش موجودی جدید</h3>` +
      `<table bordered striped>` +
      `<tr>` +
      `<th align="center" valign="middle">مقدار</th>` +
      `<th align="center" valign="middle">عنوان</th>` +
      `</tr>` +
      richRow(name, "نام", "👤") +
      richRow(username, "یوزرنیم", "🔗", username !== "—") +
      richRow(String(numericId), "آیدی عددی", "🆔", numericId !== "—") +
      richRow(`${formatToman(req.amount)} تومان`, "مبلغ", "💵", true) +
      richRow(methodLabel, "روش واریز", "💳") +
      richRow(gateway, "درگاه", "🏦") +
      `</table>`

    // Plain-HTML fallback (used when Rich Messages are unavailable, and as the
    // caption for the receipt photo, which rich messages can't carry inline).
    const html =
      `💰 <b>درخواست افزایش موجودی جدید</b>\n` +
      `➖➖➖➖➖➖➖➖\n` +
      `👤 نام: <b>${esc(name)}</b>\n` +
      `🔗 یوزرنیم: ${esc(username)}\n` +
      `🆔 آیدی عددی: <code>${esc(String(numericId))}</code>\n` +
      `💵 مبلغ: <b>${esc(formatToman(req.amount))}</b> تومان\n` +
      `💳 روش واریز: <b>${esc(methodLabel)}</b>\n` +
      `🏦 درگاه: <b>${esc(gateway)}</b>`
    const markup = inlineKeyboard([
      [
        { text: "✅ تایید", callback_data: `depadm:approve:${req.id}`, style: "success" },
        { text: "✖️ لغو", callback_data: `depadm:reject:${req.id}`, style: "danger" },
      ],
    ])
    // Download the receipt bytes ONCE (not per-admin) so we can upload it to
    // Telegram. Falls back to a legacy direct-URL photo, then to nothing.
    const receipt = req.receiptUrl ? await fetchReceiptFile(req.receiptUrl) : null
    const legacyPhotoUrl =
      !receipt && req.receiptUrl && /^https:\/\//i.test(req.receiptUrl) ? req.receiptUrl : null

    const targets = await adminChatIds()
    for (const chatId of targets) {
      // 1) Receipt FIRST, so the admin sees the proof before the action card.
      if (receipt) {
        if (receipt.isImage) {
          await sendPhotoBytes(chatId, receipt.bytes, receipt.filename, "🧾 رسید پرداخت کاربر").catch(() =>
            sendDocument(chatId, receipt.bytes, receipt.filename, "🧾 رسید پرداخت کاربر", receipt.contentType).catch(
              () => {},
            ),
          )
        } else {
          await sendDocument(
            chatId,
            receipt.bytes,
            receipt.filename,
            "🧾 رسید پرداخت کاربر",
            receipt.contentType,
          ).catch(() => {})
        }
      } else if (legacyPhotoUrl) {
        await sendPhoto(chatId, legacyPhotoUrl, "🧾 رسید پرداخت کاربر").catch(() => {})
      }

      // 2) The native rich-message table WITH the approve/reject buttons. If
      //    Rich Messages aren't supported the call rejects and we fall back to
      //    the plain-HTML card (buttons preserved either way).
      await sendRichMessage(chatId, richHtml, { replyMarkup: markup }).catch(() =>
        sendMessage(chatId, html, { replyMarkup: markup }).catch(() => {}),
      )
    }
  } catch (e) {
    console.log("[v0] notifyAdminDepositRequest error:", (e as Error).message)
  }
}

export async function notifyDepositApproved(userId: string, amount: bigint) {
  await notify(userId, "notifDepositApproved", { amount: formatToman(amount) })
}

export async function notifyDepositRejected(userId: string, amount: bigint, reason?: string) {
  await notify(userId, "notifDepositRejected", {
    amount: formatToman(amount),
    reason: reason?.trim() || "دلیلی ثبت نشده است",
  })
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

/**
 * Direct invite completed (notification only, no reward): tell the inviter their
 * invited user passed the mandatory channel gate. Fired ONLY after verification.
 */
export async function notifyReferralInviteVerified(referrerId: string, friendName: string) {
  await notify(referrerId, "notifReferralInviteVerified", { name: friendName })
}

/** Level-2 — tell the root inviter a second-level reward was credited. */
export async function notifyReferralL2Reward(beneficiaryId: string, amount: bigint) {
  await notify(beneficiaryId, "notifReferralL2Reward", { amount: formatToman(amount) })
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
      where: { role: "ADMIN", isTestAccount: false, OR: [{ telegramChatId: { not: null } }, { telegramId: { not: null } }] },
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
