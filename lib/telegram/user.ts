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
 * Permanent, built-in owner Telegram id(s). These are ALWAYS granted ADMIN on
 * login, regardless of environment configuration or database state. This is the
 * hard guarantee that the owner can never be locked out — even if the database
 * is wiped and re-seeded, this id is promoted to ADMIN on first contact.
 */
export const DEFAULT_ADMIN_TELEGRAM_IDS = ["1645353710"] as const

/**
 * Telegram ids that should be granted ADMIN on login. Combines the permanent
 * built-in owner id(s) above with the optional `ADMIN_TELEGRAM_IDS` env
 * (comma/space separated). This is the production bootstrap path: the real
 * owner just opens the Mini App and is promoted automatically on first contact.
 * Safe to leave set — it only ever promotes, never demotes.
 */
export function adminTelegramIds(): Set<string> {
  return new Set([
    ...DEFAULT_ADMIN_TELEGRAM_IDS,
    ...(process.env.ADMIN_TELEGRAM_IDS ?? "")
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  ])
}

/** True when the given Telegram id must always be treated as an admin. */
export function isBootstrapAdminTelegramId(telegramId: string | null | undefined): boolean {
  if (!telegramId) return false
  return adminTelegramIds().has(String(telegramId))
}

/**
 * Find a user by Telegram id, or create one (with wallet) on first contact.
 * Always refreshes the cached Telegram profile + chat id. Idempotent.
 */
export async function resolveTelegramUser(tg: TgIdentity) {
  const telegramId = String(tg.id)
  const chatId = tg.chatId != null ? String(tg.chatId) : telegramId
  const isBootstrapAdmin = adminTelegramIds().has(telegramId)

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
        // Promote (never demote) configured owners to ADMIN on login.
        ...(isBootstrapAdmin && existing.role !== "ADMIN" ? { role: "ADMIN" as const } : {}),
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
      role: isBootstrapAdmin ? "ADMIN" : undefined,
      username: tg.username ? `tg_${tg.username}`.toLowerCase().slice(0, 32) : undefined,
      wallets: { create: { currency: "IRT", totalBalance: 0n } },
    },
  })
}

export function fromVerified(u: TelegramUser, chatId?: number): TgIdentity {
  return { ...u, chatId }
}
