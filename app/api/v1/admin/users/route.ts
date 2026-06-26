import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { listUsers } from "@/lib/core/admin"

export const dynamic = "force-dynamic"

export const GET = route(async (req: Request) => {
  await requireAdmin()
  const q = new URL(req.url).searchParams.get("q") ?? undefined
  return listUsers(q)
})
