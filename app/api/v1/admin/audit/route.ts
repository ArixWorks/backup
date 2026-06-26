import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { listAuditLogs } from "@/lib/core/audit"

export const dynamic = "force-dynamic"

export const GET = route(async () => {
  await requireAdmin()
  return listAuditLogs(150)
})
