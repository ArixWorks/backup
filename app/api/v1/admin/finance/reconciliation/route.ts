import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { runReconciliation } from "@/lib/core/reconciliation"

export const dynamic = "force-dynamic"

export const GET = route(async () => {
  await requireAdmin()
  return runReconciliation()
})
