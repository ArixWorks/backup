import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { publishGiveawayToChannel } from "@/lib/core/giveaway-channel"

export const dynamic = "force-dynamic"

export const POST = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  const { id } = await params
  return publishGiveawayToChannel(id, admin.id)
})
