import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAiAdmin } from "@/lib/ai/permissions"
import { researchProductPrice } from "@/lib/ai/pricing-research"

export const dynamic = "force-dynamic"

// Admin-only. Performs live web research (Persian virtual-account marketplaces,
// recent only) and returns a structured "real price" recommendation for the
// compareAtPrice field. Never mutates the product — the admin approves in the UI.
const schema = z.object({
  title: z.string().min(2, "عنوان محصول لازم است"),
  planName: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  currentPrice: z.number().int().nonnegative().optional().nullable(),
})

export const POST = route(async (req: Request) => {
  const admin = await requireAiAdmin()
  const body = schema.parse(await req.json())
  return researchProductPrice(body, { userId: admin.id })
})
