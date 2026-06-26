import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { setUserStatus } from "@/lib/core/admin"

const schema = z.object({ status: z.enum(["ACTIVE", "BANNED"]) })

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  const { id } = await ctx.params
  const body = schema.parse(await req.json())
  return setUserStatus(id, body.status, admin.id)
})
