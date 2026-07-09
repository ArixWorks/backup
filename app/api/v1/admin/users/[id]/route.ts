import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { deleteUser } from "@/lib/core/admin"

// Permanently delete a user and all of their data (cascades across the schema).
// Guarded by requireAdmin; admins and self-deletion are rejected in core.
export const DELETE = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  const { id } = await ctx.params
  return deleteUser(id, admin.id)
})
