import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { ForbiddenError } from "@/lib/core/errors"
import { isBootstrapAdminTelegramId } from "@/lib/telegram/user"
import { approveErrorDiagnosis } from "@/lib/ai/error-diagnostics"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  if (!isBootstrapAdminTelegramId(admin.telegramId)) {
    throw new ForbiddenError("تأیید راهکار فقط توسط مالک اصلی مجاز است")
  }
  const { id } = await ctx.params
  const diagnosis = await approveErrorDiagnosis(id, admin.id)
  return { diagnosis, executed: false }
})
