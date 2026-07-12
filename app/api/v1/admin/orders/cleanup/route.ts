import { z } from "zod"
import { route } from "@/lib/api/handler"
import {
  cleanupFilteredOrders,
  cleanupOrders,
  listCleanupOrders,
  requireTestCleanupOwner,
  type CleanupFilters,
} from "@/lib/core/admin/test-cleanup"

export const dynamic = "force-dynamic"

const status = z.enum(["PENDING", "PAID", "DELIVERED", "REFUNDED", "CANCELLED"])
const type = z.enum(["FIXED_PURCHASE", "BUY_NOW", "AUCTION_WIN"])

function filtersFrom(url: string): CleanupFilters {
  const params = new URL(url).searchParams
  return {
    query: params.get("q") || undefined,
    status: status.optional().parse(params.get("status") || undefined),
    type: type.optional().parse(params.get("type") || undefined),
    productId: params.get("productId") || undefined,
  }
}

export const GET = route(async (req: Request) => {
  await requireTestCleanupOwner()
  const params = new URL(req.url).searchParams
  const page = z.coerce.number().int().min(1).default(1).parse(params.get("page") || undefined)
  return listCleanupOrders(filtersFrom(req.url), page)
})

const deleteSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("ids"), ids: z.array(z.string().min(1)).min(1).max(200) }),
  z.object({
    scope: z.literal("filtered"),
    confirm: z.literal("DELETE-TEST-PURCHASES"),
    filters: z.object({
      query: z.string().max(100).optional(),
      status: status.optional(),
      type: type.optional(),
      productId: z.string().optional(),
    }),
  }),
])

export const DELETE = route(async (req: Request) => {
  const admin = await requireTestCleanupOwner()
  const body = deleteSchema.parse(await req.json())
  return body.scope === "ids"
    ? cleanupOrders(body.ids, admin.id)
    : cleanupFilteredOrders(body.filters, admin.id)
})
