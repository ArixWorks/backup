import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { listTicketsAdmin } from "@/lib/core/support"

export const dynamic = "force-dynamic"

export const GET = route(async (req: Request) => {
  await requireAdmin()
  const status = new URL(req.url).searchParams.get("status") || undefined
  return listTicketsAdmin(status)
})
