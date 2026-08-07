import { z } from "zod"
import { attachmentsSchema, toAttachmentInputs } from "@/lib/api/attachment-schema"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { closeTicket, getTicket, markThreadReadByUser, replyToTicket } from "@/lib/core/support"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ publicId: string }> }

const replySchema = z.object({
  message: z.string(),
  attachments: attachmentsSchema,
})

export const GET = route(async (req: Request, ctx: Ctx) => {
  const user = await requireUser()
  const { publicId } = await ctx.params
  // Opening/polling the thread automatically marks staff messages as read,
  // giving admins a two-tick "seen" receipt (user side is automatic by design).
  const markRead = new URL(req.url).searchParams.get("markRead")
  if (markRead !== "0") await markThreadReadByUser(user.id, publicId)
  return getTicket(user.id, publicId)
})

export const POST = route(async (req: Request, ctx: Ctx) => {
  const user = await requireUser()
  const { publicId } = await ctx.params
  const body = replySchema.parse(await req.json())
  return replyToTicket({
    userId: user.id,
    publicId,
    message: body.message,
    attachments: toAttachmentInputs(body.attachments),
  })
})

export const DELETE = route(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser()
  const { publicId } = await ctx.params
  return closeTicket(user.id, publicId)
})
