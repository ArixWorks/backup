import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { drawGiveaway } from "@/lib/core/giveaway"

export const dynamic = "force-dynamic"

// Run the cryptographically-secure draw for a giveaway (admin approval action).
export const POST = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  const { id } = await params
  return drawGiveaway(id, { actorId: admin.id })
})
