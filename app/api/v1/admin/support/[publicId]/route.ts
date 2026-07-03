import { z } from "zod"
import { uploadedFileUrl } from "@/lib/api/file-url"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { getTicketAdmin, staffReply } from "@/lib/core/support"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ publicId: string }> }

const replySchema = z.object({
  message: z.string(),
  attachmentUrl: uploadedFileUrl.optional(),
  close: z.boolean().optional(),
})

export const GET = route(async (_req: Request, ctx: Ctx) => {
  await requireAdmin()
  const { publicId } = await ctx.params
  return getTicketAdmin(publicId)
})

export const POST = route(async (req: Request, ctx: Ctx) => {
  const admin = await requireAdmin()
  const { publicId } = await ctx.params
  const body = replySchema.parse(await req.json())
  return staffReply({
    staffId: admin.id,
    publicId,
    message: body.message,
    attachmentUrl: body.attachmentUrl,
    close: body.close,
  })
})
