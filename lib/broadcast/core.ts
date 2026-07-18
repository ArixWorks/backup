import "server-only"

import { Prisma } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { sendBroadcastPayload } from "@/lib/telegram/broadcast"

const animatedEmojiText = (max: number) => z.string().max(max).refine((value) => {
  const numericCodes = value.match(/\[\d+\]/g) ?? []
  return numericCodes.every((code) => /^\[\d{5,32}\]$/.test(code))
}, "شناسه ایموجی متحرک باید بین ۵ تا ۳۲ رقم باشد")

const mediaSchema = z.object({
  type: z.enum(["photo", "video", "audio", "voice", "document"]),
  url: z.string().url(),
  caption: animatedEmojiText(1024).optional(),
})

const buttonSchema = z.object({
  text: z.string().min(1).max(64),
  url: z.string().url(),
  openIn: z.enum(["BROWSER", "MINI_APP"]).default("BROWSER"),
  style: z.enum(["default", "primary", "success", "danger"]).default("default"),
})

export const telegramContentSchema = z.object({
  html: animatedEmojiText(4096).default(""),
  media: z.array(mediaSchema).max(10).default([]),
  buttons: z.array(z.array(buttonSchema).max(3)).max(8).default([]),
  disablePreview: z.boolean().default(true),
  silent: z.boolean().default(false),
  protectContent: z.boolean().default(false),
  effectId: z.string().max(64).optional(),
})

export const webContentSchema = z.object({
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(240),
  href: z.string().max(500).optional(),
  image: z.string().url().optional(),
})

export const audienceSchema = z.object({
  mode: z.enum(["ALL", "FILTERED", "SELECTED"]),
  userIds: z.array(z.string()).max(500).default([]),
  statuses: z.array(z.enum(["ACTIVE", "BANNED"])).default(["ACTIVE"]),
  vipOnly: z.boolean().default(false),
  languageCodes: z.array(z.string().max(10)).max(20).default([]),
  joinedAfter: z.string().datetime().optional(),
  joinedBefore: z.string().datetime().optional(),
  activeAfter: z.string().datetime().optional(),
  minSpent: z.coerce.number().min(0).optional(),
  maxSpent: z.coerce.number().min(0).optional(),
  minPoints: z.coerce.number().int().min(0).optional(),
  hasTelegram: z.boolean().optional(),
})

export const campaignInputSchema = z.object({
  title: z.string().min(2).max(120),
  channels: z.array(z.enum(["TELEGRAM", "WEB"])).min(1),
  audience: audienceSchema,
  telegramContent: telegramContentSchema.optional(),
  webContent: webContentSchema.optional(),
  scheduledAt: z.string().datetime().optional(),
}).superRefine((value, ctx) => {
  if (value.channels.includes("TELEGRAM") && !value.telegramContent) ctx.addIssue({ code: "custom", message: "محتوای تلگرام الزامی است" })
  if (value.channels.includes("WEB") && !value.webContent) ctx.addIssue({ code: "custom", message: "محتوای وب‌اپ الزامی است" })
})

export type CampaignInput = z.infer<typeof campaignInputSchema>
export type Audience = z.infer<typeof audienceSchema>
export type TelegramContent = z.infer<typeof telegramContentSchema>

function audienceWhere(audience: Audience): Prisma.UserWhereInput {
  if (audience.mode === "SELECTED") return { id: { in: audience.userIds } }
  return {
    status: audience.statuses.length ? { in: audience.statuses } : undefined,
    vipManual: audience.vipOnly ? true : undefined,
    languageCode: audience.languageCodes.length ? { in: audience.languageCodes } : undefined,
    createdAt: audience.joinedAfter || audience.joinedBefore ? {
      gte: audience.joinedAfter ? new Date(audience.joinedAfter) : undefined,
      lte: audience.joinedBefore ? new Date(audience.joinedBefore) : undefined,
    } : undefined,
    updatedAt: audience.activeAfter ? { gte: new Date(audience.activeAfter) } : undefined,
    totalSpent: audience.minSpent !== undefined || audience.maxSpent !== undefined ? {
      gte: audience.minSpent !== undefined ? BigInt(audience.minSpent) : undefined,
      lte: audience.maxSpent !== undefined ? BigInt(audience.maxSpent) : undefined,
    } : undefined,
    loyaltyPoints: audience.minPoints !== undefined ? { gte: audience.minPoints } : undefined,
    telegramChatId: audience.hasTelegram === true ? { not: null } : audience.hasTelegram === false ? null : undefined,
  }
}

export async function previewAudience(audience: Audience) {
  const where = audienceWhere(audience)
  const [count, sample] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, take: 12, orderBy: { createdAt: "desc" }, select: { id: true, displayName: true, username: true, telegramUsername: true, telegramChatId: true, status: true, vipManual: true, languageCode: true } }),
  ])
  return { count, sample }
}

export async function createCampaign(input: CampaignInput, createdBy: string, action: "DRAFT" | "SEND" | "SCHEDULE") {
  const users = action === "DRAFT" ? [] : await prisma.user.findMany({ where: audienceWhere(input.audience), select: { id: true, telegramChatId: true } })
  const status = action === "DRAFT" ? "DRAFT" : action === "SCHEDULE" ? "SCHEDULED" : "QUEUED"
  const campaign = await prisma.broadcastCampaign.create({
    data: {
      title: input.title,
      status,
      channels: input.channels,
      audience: input.audience,
      telegramContent: input.telegramContent ?? Prisma.JsonNull,
      webContent: input.webContent ?? Prisma.JsonNull,
      scheduledAt: action === "SCHEDULE" && input.scheduledAt ? new Date(input.scheduledAt) : null,
      createdBy,
      totalRecipients: users.length,
      pendingCount: users.length,
      recipients: {
        createMany: {
          data: users.map((user) => ({
            userId: user.id,
            telegramChatId: user.telegramChatId,
            telegramStatus: input.channels.includes("TELEGRAM") ? "PENDING" : "SKIPPED",
            webStatus: input.channels.includes("WEB") ? "PENDING" : "SKIPPED",
          })),
        },
      },
    },
  })
  return campaign
}

export async function queueDraft(campaignId: string, scheduledAt?: Date) {
  const campaign = await prisma.broadcastCampaign.findUnique({ where: { id: campaignId } })
  if (!campaign || !["DRAFT", "PAUSED"].includes(campaign.status)) throw new Error("کمپین قابل ارسال نیست")
  if (campaign.status === "DRAFT") {
    const audience = audienceSchema.parse(campaign.audience)
    const users = await prisma.user.findMany({ where: audienceWhere(audience), select: { id: true, telegramChatId: true } })
    const channels = campaign.channels as string[]
    await prisma.$transaction([
      prisma.broadcastRecipient.createMany({
        data: users.map((user) => ({
          campaignId,
          userId: user.id,
          telegramChatId: user.telegramChatId,
          telegramStatus: channels.includes("TELEGRAM") ? "PENDING" : "SKIPPED",
          webStatus: channels.includes("WEB") ? "PENDING" : "SKIPPED",
        })),
        skipDuplicates: true,
      }),
      prisma.broadcastCampaign.update({ where: { id: campaignId }, data: { totalRecipients: users.length, pendingCount: users.length, status: scheduledAt ? "SCHEDULED" : "QUEUED", scheduledAt } }),
    ])
  } else {
    await prisma.broadcastCampaign.update({ where: { id: campaignId }, data: { status: "QUEUED", cancelledAt: null } })
  }
}

export async function processBroadcastQueue(batchSize = 20) {
  const now = new Date()
  await prisma.broadcastCampaign.updateMany({ where: { status: "SCHEDULED", scheduledAt: { lte: now } }, data: { status: "QUEUED" } })
  const campaigns = await prisma.broadcastCampaign.findMany({ where: { status: { in: ["QUEUED", "SENDING"] } }, orderBy: { createdAt: "asc" }, take: 3 })
  let processed = 0
  for (const campaign of campaigns) {
    await prisma.broadcastCampaign.update({ where: { id: campaign.id }, data: { status: "SENDING", startedAt: campaign.startedAt ?? now } })
    const recipients = await prisma.broadcastRecipient.findMany({ where: { campaignId: campaign.id, OR: [{ telegramStatus: "PENDING" }, { webStatus: "PENDING" }] }, take: batchSize })
    const channels = campaign.channels as string[]
    const telegram = campaign.telegramContent ? telegramContentSchema.parse(campaign.telegramContent) : null
    const web = campaign.webContent ? webContentSchema.parse(campaign.webContent) : null
    for (const recipient of recipients) {
      const update: Prisma.BroadcastRecipientUpdateInput = { attempts: { increment: 1 } }
      let sent = false
      const errors: string[] = []
      if (channels.includes("WEB") && recipient.webStatus === "PENDING" && web) {
        try {
          await prisma.notification.create({ data: { userId: recipient.userId, type: "GENERAL", title: web.title, body: web.body, href: web.href ?? null, image: web.image ?? null } })
          update.webStatus = "SENT"; sent = true
        } catch (error) { update.webStatus = "FAILED"; errors.push((error as Error).message) }
      }
      if (channels.includes("TELEGRAM") && recipient.telegramStatus === "PENDING") {
        if (!recipient.telegramChatId || !telegram) update.telegramStatus = "SKIPPED"
        else try {
          const ids = await sendBroadcastPayload(recipient.telegramChatId, telegram)
          update.telegramStatus = "SENT"; update.telegramMessageIds = ids; sent = true
        } catch (error) { update.telegramStatus = "FAILED"; errors.push((error as Error).message) }
      }
      update.error = errors.join(" | ") || null
      update.sentAt = sent ? new Date() : undefined
      await prisma.broadcastRecipient.update({ where: { id: recipient.id }, data: update })
      processed++
    }
    const [pending, sent, failed, skipped] = await Promise.all([
      prisma.broadcastRecipient.count({ where: { campaignId: campaign.id, OR: [{ telegramStatus: "PENDING" }, { webStatus: "PENDING" }] } }),
      prisma.broadcastRecipient.count({ where: { campaignId: campaign.id, OR: [{ telegramStatus: "SENT" }, { webStatus: "SENT" }] } }),
      prisma.broadcastRecipient.count({ where: { campaignId: campaign.id, OR: [{ telegramStatus: "FAILED" }, { webStatus: "FAILED" }] } }),
      prisma.broadcastRecipient.count({ where: { campaignId: campaign.id, telegramStatus: "SKIPPED", webStatus: "SKIPPED" } }),
    ])
    await prisma.broadcastCampaign.update({ where: { id: campaign.id }, data: { pendingCount: pending, sentCount: sent, failedCount: failed, skippedCount: skipped, status: pending === 0 ? "COMPLETED" : "SENDING", completedAt: pending === 0 ? new Date() : null } })
  }
  return { campaigns: campaigns.length, processed }
}
