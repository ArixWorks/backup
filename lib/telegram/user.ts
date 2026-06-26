import "server-only"
import { prisma } from "@/lib/db"
import { randomBytes } from "crypto"
import type { TelegramUser } from "./verify"

export type TgIdentity = {
  id: number | string
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  language_code?: string
  is_premium?: boolean
  /** chat id for notifications (private chat id == user id) */
  chatId?: number | string
}

function displayNameOf(tg: TgIdentity): string {
  const name = [tg.first_name, tg.last_name].filter(Boolean).join(" ").trim()
  return name || tg.username || `کاربر ${tg.id}`
}

/**
 * Find a user by Telegram id, or create one (with wallet) on first contact.
 * Always refreshes the cached Telegram profile + chat id. Idempotent.
 */
export async function resolveTelegramUser(tg: TgIdentity) {
  const telegramId = String(tg.id)
  const chatId = tg.chatId != null ? String(tg.chatId) : telegramId

  const existing = await prisma.user.findUnique({ where: { telegramId } })
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        telegramChatId: chatId,
        telegramUsername: tg.username ?? existing.telegramUsername,
        photoUrl: tg.photo_url ?? existing.photoUrl,
        // Don't let Telegram's language_code override a manual choice.
        languageCode: existing.localeManual
          ? existing.languageCode
          : (tg.language_code ?? existing.languageCode),
        isPremium: tg.is_premium ?? existing.isPremium,
      },
    })
  }

  const alias = `Bidder#${randomBytes(2).toString("hex")}`
  return prisma.user.create({
    data: {
      telegramId,
      telegramChatId: chatId,
      telegramUsername: tg.username,
      photoUrl: tg.photo_url,
      languageCode: tg.language_code,
      isPremium: tg.is_premium ?? false,
      displayName: displayNameOf(tg),
      alias,
      username: tg.username ? `tg_${tg.username}`.toLowerCase().slice(0, 32) : undefined,
      wallets: { create: { currency: "IRT", totalBalance: 0n } },
    },
  })
}

export function fromVerified(u: TelegramUser, chatId?: number): TgIdentity {
  return { ...u, chatId }
}
