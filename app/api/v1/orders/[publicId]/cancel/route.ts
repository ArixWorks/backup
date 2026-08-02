import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { rejectExtensionAndCancel } from "@/lib/core/order-lifecycle"
import { CANCEL_REASONS } from "@/lib/orders/shared"

const reasonCodes = CANCEL_REASONS.map((r) => r.code) as [string, ...string[]]

// The buyer declines the extension ("خیر") and cancels. A reason code is
// required; free-text detail is required only for the OTHER option. The service
// cancels and refunds EXACTLY the net principal (order.amount), idempotently.
const schema = z
  .object({
    reasonCode: z.enum(reasonCodes),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((d) => d.reasonCode !== "OTHER" || (d.reason && d.reason.length > 0), {
    message: "لطفاً دلیل لغو را بنویسید.",
    path: ["reason"],
  })

export const POST = route(async (req: Request, ctx: { params: Promise<{ publicId: string }> }) => {
  const user = await requireUser()
  const { publicId } = await ctx.params
  const body = schema.parse(await req.json())
  await rejectExtensionAndCancel(publicId, user.id, { reasonCode: body.reasonCode, reason: body.reason ?? null })
  return { ok: true }
})
