import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { closeTicket, getTicket, replyToTicket } from "@/lib/core/support"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ publicId: string }> }

const replySchema = z.object({
  message: z.string(),
  attachmentUrl: z.string().url().optional(),
})

export const GET = route(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser()
  const { publicId } = await ctx.params
  return getTicket(user.id, publicId)
})

export const POST = route(async (req: Request, ctx: Ctx) => {
  const user = await requireUser()
  const { publicId } = await ctx.params
  const body = replySchema.parse(await req.json())
  return replyToTicket({ userId: user.id, publicId, message: body.message, attachmentUrl: body.attachmentUrl })
})

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser()
  const { publicId } = await ctx.params
  return closeTicket(user.id, publicId)
})
