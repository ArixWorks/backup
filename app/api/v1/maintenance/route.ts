import { route } from "@/lib/api/handler"
import { getMaintenance } from "@/lib/core/settings"

export const dynamic = "force-dynamic"

/**
 * Public maintenance state. Read by the web/Mini App shell to decide whether to
 * show the maintenance notice. Safe to expose: it only reveals the (already
 * user-facing) notice text, never any secret.
 */
export const GET = route(async () => {
  const m = await getMaintenance()
  return {
    enabled: m.enabled,
    title: m.title,
    message: m.message,
    supportUrl: m.supportUrl,
  }
})
