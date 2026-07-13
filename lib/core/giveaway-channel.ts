import "server-only"

import { prisma } from "@/lib/db"
import { escapeHtml } from "@/lib/channel-format"
import { sendMessage, sendPhoto } from "@/lib/telegram/api"
import { getBotConfig } from "@/lib/telegram/settings"
import { ConflictError, NotFoundError, ValidationError } from "@/lib/core/errors"
import { audit } from "@/lib/core/audit"

export type GiveawayChannelPublication = {
  status: "NOT_SENT" | "SENT" | "FAILED"
  messageId?: number
  sentAt?: string
  error?: string
}

const keyFor = (id: string) => `giveaway_channel:${id}`

export async function getGiveawayChannelPublication(id: string): Promise<GiveawayChannelPublication> {
  const row = await prisma.botSetting.findUnique({ where: { key: keyFor(id) } })
  if (!row) return { status: "NOT_SENT" }
  try {
    return JSON.parse(row.value) as GiveawayChannelPublication
  } catch {
    return { status: "FAILED", error: "وضعیت ارسال قابل خواندن نیست" }
  }
}

async function savePublication(id: string, value: GiveawayChannelPublication) {
  await prisma.botSetting.upsert({
    where: { key: keyFor(id) },
    create: { key: keyFor(id), value: JSON.stringify(value) },
    update: { value: JSON.stringify(value) },
  })
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tehran",
  }).format(value)
}

export async function publishGiveawayToChannel(id: string, actorId: string) {
  const [giveaway, previous, config] = await Promise.all([
    prisma.giveaway.findUnique({ where: { id } }),
    getGiveawayChannelPublication(id),
    getBotConfig(),
  ])
  if (!giveaway) throw new NotFoundError("قرعه‌کشی یافت نشد")
  if (["DRAFT", "CANCELLED", "FINISHED"].includes(giveaway.status)) {
    throw new ValidationError("فقط قرعه‌کشی منتشرشده و فعال را می‌توان به کانال ارسال کرد")
  }
  if (previous.status === "SENT") throw new ConflictError("پیام این قرعه‌کشی قبلاً به کانال ارسال شده است")
  if (!config.channelId) throw new ValidationError("کانال اصلی در تنظیمات ربات مشخص نشده است")
  if (!config.botUsername) throw new ValidationError("نام کاربری ربات در تنظیمات ربات مشخص نشده است")

  const botUsername = config.botUsername.replace(/^@/, "")
  const miniAppUrl = `https://t.me/${botUsername}?startapp=${encodeURIComponent(`giveaway_${giveaway.slug}`)}`
  const body = [
    `<b>${escapeHtml(giveaway.title)}</b>`,
    giveaway.subtitle ? escapeHtml(giveaway.subtitle) : null,
    "",
    `<b>جایزه:</b> ${escapeHtml(giveaway.prizeLabel)}`,
    `<b>تعداد برندگان:</b> ${giveaway.winnersCount.toLocaleString("fa-IR")}`,
    `<b>مهلت شرکت:</b> ${escapeHtml(formatDate(giveaway.endAt))}`,
    "",
    "برای مشاهده شرایط و شرکت در قرعه‌کشی، دکمه زیر را بزنید.",
  ].filter((line) => line !== null).join("\n")
  const replyMarkup = { inline_keyboard: [[{ text: "شرکت در قرعه‌کشی", url: miniAppUrl }]] }

  try {
    const result = giveaway.prizeImage || giveaway.coverImage
      ? await sendPhoto(config.channelId, giveaway.prizeImage || giveaway.coverImage!, body, { replyMarkup })
      : await sendMessage(config.channelId, body, { replyMarkup })
    const publication: GiveawayChannelPublication = {
      status: "SENT",
      messageId: Number((result as { message_id?: number }).message_id),
      sentAt: new Date().toISOString(),
    }
    await savePublication(id, publication)
    await audit({ actorId, action: "giveaway.channel.publish", entity: "giveaway", entityId: id, meta: { messageId: publication.messageId } })
    return publication
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "خطای ناشناخته تلگرام"
    await savePublication(id, { status: "FAILED", error: message })
    await audit({ actorId, action: "giveaway.channel.publish_failed", entity: "giveaway", entityId: id, meta: { error: message } })
    throw error
  }
}
