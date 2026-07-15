import { Prisma } from "@prisma/client"
import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/core/audit"
import { ConflictError, NotFoundError } from "@/lib/core/errors"
import { completeDomainOrder, extendDomainOrderHold, failDomainOrder } from "@/lib/core/domains/service"

const tldPattern = /^\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const tldSchema = z.string().trim().toLowerCase().transform((value) => value.startsWith(".") ? value : `.${value}`).pipe(z.string().regex(tldPattern, "پسوند معتبر نیست."))
const priceSchema = z.coerce.bigint().positive("قیمت ثبت باید بیشتر از صفر باشد.")

export const GET = route(async (req: Request) => {
  await requireAdmin()
  const url = new URL(req.url)
  const query = url.searchParams.get("q")?.trim().toLowerCase() ?? ""
  const status = url.searchParams.get("status") ?? "all"
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1))
  const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get("pageSize") ?? 25)))
  const where: Prisma.DomainTldWhereInput = {
    ...(query ? { OR: [{ tld: { contains: query } }, { title: { contains: query, mode: "insensitive" } }] } : {}),
    ...(status === "active" ? { active: true, supported: true } : status === "inactive" ? { OR: [{ active: false }, { supported: false }] } : {}),
  }
  const [tlds, total, activeCount, orders, totals] = await Promise.all([
    prisma.domainTld.findMany({ where, orderBy: [{ displayOrder: "asc" }, { tld: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.domainTld.count({ where }),
    prisma.domainTld.count({ where: { active: true, supported: true } }),
    prisma.domainOrder.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.domainOrder.groupBy({ by: ["status"], _count: { _all: true }, _sum: { amountIrt: true } }),
  ])
  return { tlds, pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) }, catalog: { total: await prisma.domainTld.count(), active: activeCount }, orders, totals }
})

const updateSchema = z.object({
  id: z.string().cuid(),
  title: z.string().trim().min(1).max(80).optional(),
  active: z.boolean().optional(),
  supported: z.boolean().optional(),
  basePriceIrt: priceSchema.optional(),
  displayOrder: z.coerce.number().int().min(0).max(10000).optional(),
})

export const PATCH = route(async (req: Request) => {
  const admin = await requireAdmin()
  const body = updateSchema.parse(await req.json())
  const { id, ...data } = body
  const updated = await prisma.domainTld.update({ where: { id }, data })
  await audit({ actorId: admin.id, action: "domain.tld.update", entity: "DomainTld", entityId: id, meta: { ...data, basePriceIrt: data.basePriceIrt?.toString() } })
  return updated
})

const createSchema = z.object({ action: z.literal("createTld"), tld: tldSchema, title: z.string().trim().min(1).max(80), basePriceIrt: priceSchema, active: z.boolean().default(true), displayOrder: z.coerce.number().int().min(0).max(10000).default(0) })
const importSchema = z.object({ action: z.literal("importTlds"), rows: z.array(z.object({ tld: tldSchema, title: z.string().trim().min(1).max(80), basePriceIrt: priceSchema, active: z.boolean().default(true) })).min(1).max(500) })
const bulkSchema = z.object({ action: z.literal("bulkStatus"), ids: z.array(z.string().cuid()).min(1).max(500), active: z.boolean() })
const archiveSchema = z.object({ action: z.literal("archiveTld"), id: z.string().cuid() })
const deleteSchema = z.object({ action: z.literal("deleteTld"), id: z.string().cuid() })
const orderActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("complete"), orderId: z.string(), providerReference: z.string().trim().max(200).optional() }),
  z.object({ action: z.literal("fail"), orderId: z.string(), reason: z.string().trim().min(3).max(500) }),
  z.object({ action: z.literal("extend"), orderId: z.string(), minutes: z.coerce.number().int().min(15).max(4320) }),
])
const actionSchema = z.union([createSchema, importSchema, bulkSchema, archiveSchema, deleteSchema, orderActionSchema])

export const POST = route(async (req: Request) => {
  const admin = await requireAdmin()
  const body = actionSchema.parse(await req.json())

  if (body.action === "createTld") {
    const existing = await prisma.domainTld.findUnique({ where: { tld: body.tld } })
    if (existing) throw new ConflictError("این پسوند قبلاً در کاتالوگ ثبت شده است.")
    const created = await prisma.domainTld.create({ data: { tld: body.tld, title: body.title, basePriceIrt: body.basePriceIrt, active: body.active, supported: body.active, displayOrder: body.displayOrder, provider: "railway-domains" } })
    await audit({ actorId: admin.id, action: "domain.tld.create", entity: "DomainTld", entityId: created.id, meta: { tld: created.tld, basePriceIrt: created.basePriceIrt.toString() } })
    return created
  }

  if (body.action === "importTlds") {
    const duplicateInput = body.rows.map((row) => row.tld).filter((tld, index, all) => all.indexOf(tld) !== index)
    if (duplicateInput.length) throw new ConflictError(`پسوند تکراری در فایل: ${[...new Set(duplicateInput)].join("، ")}`)
    const existing = await prisma.domainTld.findMany({ where: { tld: { in: body.rows.map((row) => row.tld) } }, select: { tld: true } })
    if (existing.length) throw new ConflictError(`این پسوندها از قبل وجود دارند: ${existing.map((row) => row.tld).join("، ")}`)
    const result = await prisma.$transaction(body.rows.map((row, index) => prisma.domainTld.create({ data: { ...row, supported: row.active, displayOrder: index, provider: "railway-domains" } })))
    await audit({ actorId: admin.id, action: "domain.tld.import", entity: "DomainTld", meta: { count: result.length, tlds: result.map((row) => row.tld) } })
    return { imported: result.length }
  }

  if (body.action === "bulkStatus") {
    const result = await prisma.domainTld.updateMany({ where: { id: { in: body.ids } }, data: { active: body.active, supported: body.active } })
    await audit({ actorId: admin.id, action: "domain.tld.bulk_status", entity: "DomainTld", meta: { ids: body.ids, active: body.active, count: result.count } })
    return result
  }

  if (body.action === "archiveTld") {
    const tld = await prisma.domainTld.findUnique({ where: { id: body.id } })
    if (!tld) throw new NotFoundError("پسوند پیدا نشد.")
    const updated = await prisma.domainTld.update({ where: { id: body.id }, data: { active: false, supported: false } })
    await audit({ actorId: admin.id, action: "domain.tld.archive", entity: "DomainTld", entityId: body.id, meta: { tld: tld.tld } })
    return updated
  }

  if (body.action === "deleteTld") {
    const tld = await prisma.domainTld.findUnique({ where: { id: body.id } })
    if (!tld) throw new NotFoundError("پسوند پیدا نشد.")
    const historicalOrders = await prisma.domainOrder.count({ where: { tld: tld.tld } })
    await prisma.domainTld.delete({ where: { id: body.id } })
    await audit({ actorId: admin.id, action: "domain.tld.delete", entity: "DomainTld", entityId: body.id, meta: { tld: tld.tld, historicalOrders } })
    return { deleted: true, tld: tld.tld, historicalOrders }
  }

  const result = body.action === "complete"
    ? await completeDomainOrder(body.orderId, admin.id, body.providerReference)
    : body.action === "fail"
      ? await failDomainOrder(body.orderId, admin.id, body.reason)
      : await extendDomainOrderHold(body.orderId, admin.id, body.minutes)
  await audit({ actorId: admin.id, action: `domain.order.${body.action}`, entity: "DomainOrder", entityId: body.orderId })
  return result
})
