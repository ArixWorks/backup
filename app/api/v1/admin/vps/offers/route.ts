import { z } from "@/lib/zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { listOffersAdmin, createOffer, deleteOffers } from "@/lib/core/vps/catalog"
import { vpsOfferCreateSchema, toOfferInput } from "@/lib/core/vps/schema"

export const dynamic = "force-dynamic"

export const GET = route(async () => {
  await requireAdmin()
  return listOffersAdmin()
})

export const POST = route(async (req: Request) => {
  await requireAdmin()
  const body = vpsOfferCreateSchema.parse(await req.json())
  return createOffer(toOfferInput(body) as never)
})

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "حداقل یک مورد را انتخاب کنید").max(200),
})

export const DELETE = route(async (req: Request) => {
  await requireAdmin()
  const { ids } = bulkDeleteSchema.parse(await req.json())
  return deleteOffers(ids)
})
