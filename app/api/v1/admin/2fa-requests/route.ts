import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { listReRequests } from "@/lib/core/totp-service"

export const dynamic = "force-dynamic"

// GET: the 2FA re-request queue, newest first (pending surfaced first).
export const GET = route(async (req: Request) => {
  await requireAdmin()
  const status = new URL(req.url).searchParams.get("status")
  const valid = status === "PENDING" || status === "APPROVED" || status === "REJECTED"
  return listReRequests(valid ? (status as "PENDING" | "APPROVED" | "REJECTED") : undefined)
})
