import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { listRefundsAdmin } from "@/lib/core/refunds"

export const dynamic = "force-dynamic"

export const GET = route(async (req: Request) => {
  await requireAdmin()
  const status = new URL(req.url).searchParams.get("status") as
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | "PAID"
    | null
  return listRefundsAdmin(status ?? undefined)
})
