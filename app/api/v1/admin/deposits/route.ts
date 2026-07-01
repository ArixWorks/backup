import type { DepositStatus } from "@prisma/client"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { listDeposits } from "@/lib/core/finance"

export const dynamic = "force-dynamic"

const STATUSES = new Set(["PENDING", "APPROVED", "REJECTED", "EXPIRED"])

export const GET = route(async (req: Request) => {
  await requireAdmin()
  const raw = new URL(req.url).searchParams.get("status")
  const status = raw && STATUSES.has(raw) ? (raw as DepositStatus) : undefined
  return listDeposits(status)
})
