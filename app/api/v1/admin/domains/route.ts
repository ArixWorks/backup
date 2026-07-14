import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/core/audit"
import { completeDomainOrder, extendDomainOrderHold, failDomainOrder } from "@/lib/core/domains/service"

export const GET = route(async () => {
  await requireAdmin()
  const [tlds, orders, totals] = await Promise.all([
    prisma.domainTld.findMany({ orderBy: { displayOrder: "asc" } }),
    prisma.domainOrder.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.domainOrder.groupBy({ by: ["status"], _count: { _all: true }, _sum: { amountIrt: true } }),
  ])
  return { tlds, orders, totals }
})

const schema = z.object({
  id: z.string().cuid(),
  active: z.boolean().optional(),
  supported: z.boolean().optional(),
  basePriceIrt: z.coerce.bigint().positive().optional(),
  renewalPriceIrt: z.coerce.bigint().positive().nullable().optional(),
})

export const PATCH = route(async (req: Request) => {
  const admin = await requireAdmin()
  const body = schema.parse(await req.json())
  const { id, ...data } = body
  const updated = await prisma.domainTld.update({ where: { id }, data })
  await audit({
    actorId: admin.id,
    action: "domain.tld.update",
    entity: "DomainTld",
    entityId: id,
    meta: {
      ...data,
      basePriceIrt: data.basePriceIrt?.toString(),
      renewalPriceIrt: data.renewalPriceIrt?.toString() ?? null,
    },
  })
  return updated
})

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("complete"), orderId: z.string(), providerReference: z.string().trim().max(200).optional() }),
  z.object({ action: z.literal("fail"), orderId: z.string(), reason: z.string().trim().min(3).max(500) }),
  z.object({ action: z.literal("extend"), orderId: z.string(), minutes: z.coerce.number().int().min(15).max(4320) }),
])

export const POST = route(async (req: Request) => {
  const admin = await requireAdmin()
  const body = actionSchema.parse(await req.json())
  const result = body.action === "complete"
    ? await completeDomainOrder(body.orderId, admin.id, body.providerReference)
    : body.action === "fail"
      ? await failDomainOrder(body.orderId, admin.id, body.reason)
      : await extendDomainOrderHold(body.orderId, admin.id, body.minutes)
  await audit({ actorId: admin.id, action: `domain.order.${body.action}`, entity: "DomainOrder", entityId: body.orderId })
  return result
})
