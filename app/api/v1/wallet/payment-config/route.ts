import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { getPaymentConfig } from "@/lib/core/settings"

export const dynamic = "force-dynamic"

/** Active top-up methods + destination details for the "Add funds" sheet. */
export const GET = route(async () => {
  await requireUser()
  const cfg = await getPaymentConfig()
  return {
    minToman: cfg.minToman,
    methods: cfg.methods.filter((m) => m.enabled),
  }
})
