import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { listWithdrawals } from "@/lib/core/finance"

export const dynamic = "force-dynamic"

export const GET = route(async (req: Request) => {
  await requireAdmin()
  const status = new URL(req.url).searchParams.get("status") as
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | "PAID"
    | null
  return listWithdrawals(status ?? undefined)
})
