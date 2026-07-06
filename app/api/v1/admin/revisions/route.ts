import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { ValidationError } from "@/lib/core/errors"
import { prisma } from "@/lib/db"
import { sanitizeHtml } from "@/lib/rich-content/sanitize"

export const dynamic = "force-dynamic"

/**
 * Version history for a rich field. List revisions for an entity/field, most
 * recent first. Identified by entityType + entityId + field.
 */
export const GET = route(async (req: Request) => {
  await requireAdmin()
  const url = new URL(req.url)
  const entityType = url.searchParams.get("entityType")
  const entityId = url.searchParams.get("entityId")
  const field = url.searchParams.get("field") ?? "description"
  if (!entityType || !entityId) throw new ValidationError("شناسه محتوا نامعتبر است")
  const items = await prisma.contentRevision.findMany({
    where: { entityType, entityId, field },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
  return { items }
})

/**
 * Snapshot a revision. Called on save/publish so the previous content can be
 * restored later. `status` distinguishes drafts from published snapshots.
 */
export const POST = route(async (req: Request) => {
  const admin = await requireAdmin()
  const body = (await req.json()) as {
    entityType?: string
    entityId?: string
    field?: string
    html?: string
    status?: string
    note?: string
  }
  if (!body.entityType || !body.entityId) throw new ValidationError("شناسه محتوا نامعتبر است")
  if (body.html === undefined) throw new ValidationError("محتوا الزامی است")
  const revision = await prisma.contentRevision.create({
    data: {
      entityType: body.entityType,
      entityId: body.entityId,
      field: body.field ?? "description",
      html: sanitizeHtml(body.html),
      status: body.status ?? "revision",
      note: body.note ?? null,
      createdById: admin.id,
    },
  })

  // Keep history bounded: retain the newest 50 revisions per field.
  const stale = await prisma.contentRevision.findMany({
    where: { entityType: body.entityType, entityId: body.entityId, field: body.field ?? "description" },
    orderBy: { createdAt: "desc" },
    skip: 50,
    select: { id: true },
  })
  if (stale.length) {
    await prisma.contentRevision.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } })
  }
  return revision
})
