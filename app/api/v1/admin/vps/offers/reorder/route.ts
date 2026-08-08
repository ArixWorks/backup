import { z } from "@/lib/zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { reorderOffers } from "@/lib/core/vps/catalog"

export const dynamic = "force-dynamic"

const schema = z.object({
  order: z
    .array(z.object({ id: z.string().min(1), sortOrder: z.number().int().min(0).max(100000) }))
    .min(1)
    .max(500),
})

export const POST = route(async (req: Request) => {
  await requireAdmin()
  const { order } = schema.parse(await req.json())
  return reorderOffers(order)
})
