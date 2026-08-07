import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { listTicketsAdmin } from "@/lib/core/support"

export const dynamic = "force-dynamic"

export const GET = route(async (req: Request) => {
  await requireAdmin()
  const sp = new URL(req.url).searchParams
  return listTicketsAdmin({
    status: sp.get("status") || undefined,
    category: sp.get("category") || undefined,
    q: sp.get("q") || undefined,
  })
})
