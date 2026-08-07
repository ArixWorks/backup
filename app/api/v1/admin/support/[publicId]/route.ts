import { z } from "zod"
import { attachmentsSchema, toAttachmentInputs } from "@/lib/api/attachment-schema"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import {
  getTicketAdmin,
  setTicketCategory,
  setTicketStatus,
  staffReply,
  SUPPORT_CATEGORIES,
  SUPPORT_STATUSES,
} from "@/lib/core/support"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ publicId: string }> }

const replySchema = z.object({
  message: z.string(),
  // Optional rich HTML from the admin TipTap editor; sanitized server-side.
  html: z.string().max(50_000).optional(),
  attachments: attachmentsSchema,
  close: z.boolean().optional(),
})

const patchSchema = z.object({
  status: z.enum(SUPPORT_STATUSES).optional(),
  category: z.enum(SUPPORT_CATEGORIES).optional(),
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
    html: body.html,
    attachments: toAttachmentInputs(body.attachments),
    close: body.close,
  })
})

// Update workflow status and/or category from inside the thread.
export const PATCH = route(async (req: Request, ctx: Ctx) => {
  const admin = await requireAdmin()
  const { publicId } = await ctx.params
  const body = patchSchema.parse(await req.json())
  if (body.status) await setTicketStatus({ staffId: admin.id, publicId, status: body.status })
  if (body.category) await setTicketCategory({ staffId: admin.id, publicId, category: body.category })
  return getTicketAdmin(publicId)
})
