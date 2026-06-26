import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { completeManualDelivery } from "@/lib/core/admin"

const schema = z.object({
  username: z.string().optional(),
  password: z.string().optional(),
  licenseKey: z.string().optional(),
  note: z.string().optional(),
})

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  const { id } = await ctx.params
  const body = schema.parse(await req.json())
  const payload = Object.fromEntries(
    Object.entries(body).filter(([, v]) => v != null && v !== ""),
  )
  return completeManualDelivery(id, payload, admin.id)
})
