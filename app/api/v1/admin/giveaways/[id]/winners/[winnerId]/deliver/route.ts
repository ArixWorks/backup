import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { markWinnerDelivered } from "@/lib/core/giveaway"

// Accepts either the legacy typed fields or a dynamic template-keyed `fields`
// map. Both are merged into a single credential payload.
const deliverySchema = z
  .object({
    username: z.string().trim().max(500).optional(),
    password: z.string().trim().max(500).optional(),
    licenseKey: z.string().trim().max(2000).optional(),
    note: z.string().trim().max(10_000).optional(),
    fields: z.record(z.string(), z.string().trim().max(10_000)).optional(),
  })
  .refine(
    (value) =>
      Boolean(value.username || value.password || value.licenseKey || value.note) ||
      (value.fields && Object.values(value.fields).some((v) => v.trim() !== "")),
    { message: "حداقل یک فیلد تحویل را پر کنید" },
  )

export const POST = route(
  async (
    req: Request,
    ctx: { params: Promise<{ id: string; winnerId: string }> },
  ) => {
    const admin = await requireAdmin()
    const { id, winnerId } = await ctx.params
    const body = deliverySchema.parse(await req.json())
    // Merge dynamic fields with any legacy typed fields into one flat payload.
    const { fields, ...legacy } = body
    const payload: Record<string, string> = { ...(fields ?? {}) }
    for (const [k, v] of Object.entries(legacy)) {
      if (typeof v === "string" && v.trim() !== "") payload[k] = v
    }
    const winner = await markWinnerDelivered(id, winnerId, payload, admin.id)
    return { id: winner.id, delivered: winner.delivered, deliveredAt: winner.deliveredAt }
  },
)
