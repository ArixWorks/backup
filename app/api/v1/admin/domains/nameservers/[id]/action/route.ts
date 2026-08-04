import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { completeNsRequest, rejectNsRequest } from "@/lib/core/domains/nameservers"

export const dynamic = "force-dynamic"

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("complete") }),
  z.object({ action: z.literal("reject"), note: z.string().trim().max(200).optional() }),
])

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  const { id } = await ctx.params
  const body = schema.parse(await req.json())
  switch (body.action) {
    case "complete":
      return completeNsRequest(id, admin.id)
    case "reject":
      return rejectNsRequest(id, admin.id, body.note)
  }
})
