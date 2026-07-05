import "server-only"
import { requireAdmin } from "@/lib/auth/session"
import { ForbiddenError } from "@/lib/core/errors"
import { isBootstrapAdminTelegramId } from "@/lib/telegram/user"

/**
 * AI permission layer.
 *
 * - `requireAiAdmin`: any admin may use/manage AI features and view analytics.
 * - `requireSuperAdmin`: only the permanent built-in owner (bootstrap admin)
 *   may view or mutate secret API keys. This keeps provider credentials behind
 *   the highest privilege tier, per the security requirements.
 */

export async function requireAiAdmin() {
  return requireAdmin()
}

export async function requireSuperAdmin() {
  const user = await requireAdmin()
  if (!isBootstrapAdminTelegramId(user.telegramId)) {
    throw new ForbiddenError("این عملیات فقط برای مدیر ارشد مجاز است")
  }
  return user
}

export async function isSuperAdmin(telegramId: string | null | undefined): Promise<boolean> {
  return isBootstrapAdminTelegramId(telegramId)
}
