import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { getWallexStatus, syncWallexRates } from "@/lib/core/wallex"

export const dynamic = "force-dynamic"

/** Current Wallex FX sync configuration + last snapshot. */
export const GET = route(async () => {
  await requireAdmin()
  return getWallexStatus()
})

/** Force an immediate Wallex FX sync (admin "sync now"). */
export const POST = route(async () => {
  await requireAdmin()
  const result = await syncWallexRates()
  const status = await getWallexStatus()
  return { result, status }
})
