import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/core/audit"

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
  await audit({ actorId: admin.id, action: "domain.tld.update", entity: "DomainTld", entityId: id, meta: data })
  return updated
})
