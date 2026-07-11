import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin, createSession } from "@/lib/auth/session"
import { isBootstrapAdminTelegramId } from "@/lib/telegram/user"
import { ForbiddenError } from "@/lib/core/errors"
import { runFactoryReset } from "@/lib/core/admin/factory-reset"
import { audit } from "@/lib/core/audit"

export const dynamic = "force-dynamic"

// The client must echo this exact phrase to arm the wipe (defence-in-depth on
// top of the typed-confirmation UI).
const CONFIRM_PHRASE = "ERASE-ALL-DATA"

const schema = z.object({ confirm: z.literal(CONFIRM_PHRASE) })

export const POST = route(async (req: Request) => {
  const admin = await requireAdmin()

  // A full factory reset is OWNER-only — not every ADMIN. Restrict to the
  // permanent built-in owner (bootstrap Telegram id), never a promoted staff
  // admin, so a compromised staff account cannot nuke the platform.
  if (!isBootstrapAdminTelegramId(admin.telegramId)) {
    throw new ForbiddenError("فقط مالک اصلی می‌تواند ریست کامل انجام دهد")
  }

  schema.parse(await req.json())

  const result = await runFactoryReset()

  // Re-establish the operator's session against the freshly re-created owner
  // account (the old user row — and its session validity — was just wiped).
  await createSession(result.owner.id, 0)

  // Audit is written AFTER the wipe (the wipe clears AuditLog).
  await audit({
    actorId: result.owner.id,
    action: "FACTORY_RESET",
    entity: "System",
    entityId: null,
    meta: { deletedRows: result.deletedRows, ownerRestored: true, hasPassword: result.owner.hasPassword },
  })

  return {
    deletedRows: result.deletedRows,
    ownerRestored: true,
    hasPassword: result.owner.hasPassword,
  }
})
