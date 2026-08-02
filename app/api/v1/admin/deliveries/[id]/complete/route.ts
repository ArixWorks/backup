import { z, optionalDbId } from "@/lib/zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { completeManualDelivery } from "@/lib/core/admin"

// The credential payload is DYNAMIC: keys come from the product's delivery-field
// template (e.g. email, username, password, totp, licenseKey, or any custom
// key an admin defined). A fixed whitelist would silently drop every custom
// field, so we accept `tutorialId` explicitly and treat ALL other keys as
// string credential values via a catchall. This was the bug where only the
// field literally named "password" survived delivery.
const schema = z
  .object({
    // Empty string from an unselected <select> is coerced to null (no tutorial).
    tutorialId: optionalDbId,
  })
  .catchall(z.string())

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  const { id } = await ctx.params
  const { tutorialId, ...credentials } = schema.parse(await req.json())
  const payload = Object.fromEntries(
    Object.entries(credentials).filter(([, v]) => typeof v === "string" && v.trim() !== ""),
  )
  return completeManualDelivery(id, payload, admin.id, tutorialId)
})
