import type { Content, ContentStatus, Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { ConflictError, NotFoundError, ValidationError } from "@/lib/core/errors"
import { sanitizeRichHtml } from "@/lib/rich-content/sanitize"
import { slugify } from "@/lib/rich-content/render"
import { requireContentType } from "./registry"
import { fieldsSchema, type ContentTypeDef } from "./types"
import { syncRelations, type RelationInput } from "./relations"

/**
 * Core content service. All writes flow through here so validation, HTML
 * sanitization, slug uniqueness, revision snapshots and relation syncing stay
 * consistent across every content type and every caller.
 */

export interface ContentWriteInput {
  title: string
  slug?: string
  locale?: string
  excerpt?: string | null
  body?: string
  status?: ContentStatus
  scheduledFor?: string | null
  // SEO
  seoTitle?: string | null
  seoDescription?: string | null
  seoKeywords?: string[]
  ogImageUrl?: string | null
  canonicalUrl?: string | null
  noindex?: boolean
  // presentation / taxonomy
  coverImageUrl?: string | null
  order?: number
  categoryId?: string | null
  tagIds?: string[]
  // navigation
  navShow?: boolean
  navLabel?: string | null
  navIcon?: string | null
  navOrder?: number
  navPlacement?: string[]
  navParentId?: string | null
  breadcrumbLabel?: string | null
  // custom fields + relations
  fields?: Record<string, unknown>
  relations?: RelationInput[]
}

export interface ListParams {
  type: string
  status?: ContentStatus
  categoryId?: string
  q?: string
  page?: number
  pageSize?: number
  publicOnly?: boolean
}

const NAV_PLACEMENTS = new Set(["HEADER", "FOOTER", "SIDEBAR"])

async function uniqueSlug(type: string, locale: string, base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || "item"
  let candidate = root
  let n = 1
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const clash = await prisma.content.findFirst({
      where: { type, locale, slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    })
    if (!clash) return candidate
    n += 1
    candidate = `${root}-${n}`
  }
}

/** Build the persisted column payload (shared by create + update). */
function buildData(def: ContentTypeDef, input: ContentWriteInput): Prisma.ContentUncheckedUpdateInput {
  const data: Prisma.ContentUncheckedUpdateInput = {}
  if (input.title !== undefined) data.title = input.title.trim()
  if (input.excerpt !== undefined) data.excerpt = input.excerpt?.trim() || null
  if (input.body !== undefined) data.body = sanitizeRichHtml(input.body)
  if (input.order !== undefined) data.order = input.order
  if (input.coverImageUrl !== undefined) data.coverImageUrl = input.coverImageUrl || null
  if (def.taxonomy.categories && input.categoryId !== undefined) data.categoryId = input.categoryId || null

  // SEO (sanitize free-text meta as plain-ish HTML too)
  if (input.seoTitle !== undefined) data.seoTitle = input.seoTitle?.trim() || null
  if (input.seoDescription !== undefined) data.seoDescription = input.seoDescription?.trim() || null
  if (input.seoKeywords !== undefined) data.seoKeywords = input.seoKeywords
  if (input.ogImageUrl !== undefined) data.ogImageUrl = input.ogImageUrl || null
  if (input.canonicalUrl !== undefined) data.canonicalUrl = input.canonicalUrl || null
  if (input.noindex !== undefined) data.noindex = input.noindex

  // Navigation metadata
  if (def.navigation.canAppearInNav) {
    if (input.navShow !== undefined) data.navShow = input.navShow
    if (input.navLabel !== undefined) data.navLabel = input.navLabel?.trim() || null
    if (input.navIcon !== undefined) data.navIcon = input.navIcon?.trim() || null
    if (input.navOrder !== undefined) data.navOrder = input.navOrder
    if (input.navPlacement !== undefined) {
      data.navPlacement = input.navPlacement.filter((p) => NAV_PLACEMENTS.has(p))
    }
    if (input.navParentId !== undefined) data.navParentId = input.navParentId || null
    if (input.breadcrumbLabel !== undefined) data.breadcrumbLabel = input.breadcrumbLabel?.trim() || null
  }

  // Custom fields validated against the registry schema.
  if (input.fields !== undefined) {
    const parsed = fieldsSchema(def).safeParse(input.fields)
    if (!parsed.success) throw new ValidationError("مقادیر فیلدهای اختصاصی نامعتبر است")
    data.fields = parsed.data as Prisma.InputJsonValue
  }
  return data
}

async function snapshot(typeKey: string, contentId: string, body: string, status: string, createdById?: string) {
  await prisma.contentRevision.create({
    data: { entityType: typeKey, entityId: contentId, field: "body", html: body, status, createdById: createdById ?? null },
  })
  const stale = await prisma.contentRevision.findMany({
    where: { entityType: typeKey, entityId: contentId, field: "body" },
    orderBy: { createdAt: "desc" },
    skip: 50,
    select: { id: true },
  })
  if (stale.length) await prisma.contentRevision.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } })
}

export async function listContent(params: ListParams) {
  const { type, status, categoryId, q, page = 1, pageSize = 20, publicOnly } = params
  requireContentType(type)
  const where: Prisma.ContentWhereInput = { type }
  if (status) where.status = status
  if (publicOnly) where.status = "PUBLISHED"
  if (categoryId) where.categoryId = categoryId
  if (q) where.title = { contains: q, mode: "insensitive" }

  const [items, total] = await Promise.all([
    prisma.content.findMany({
      where,
      orderBy: [{ order: "asc" }, { publishedAt: "desc" }, { updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { category: true, tags: true },
    }),
    prisma.content.count({ where }),
  ])
  return { items, total, page, pageSize }
}

export async function getContent(id: string) {
  const content = await prisma.content.findUnique({
    where: { id },
    include: { category: true, tags: true, relations: true },
  })
  if (!content) throw new NotFoundError("محتوا یافت نشد")
  return content
}

export async function getContentBySlug(type: string, slug: string, opts?: { publicOnly?: boolean; locale?: string }) {
  const content = await prisma.content.findFirst({
    where: {
      type,
      slug,
      locale: opts?.locale ?? "fa",
      ...(opts?.publicOnly ? { status: "PUBLISHED" } : {}),
    },
    include: { category: true, tags: true },
  })
  return content
}

/** The single document for a singleton content type (e.g. rules, vps landing). */
export async function getSingleton(type: string, opts?: { publicOnly?: boolean }) {
  return prisma.content.findFirst({
    where: { type, ...(opts?.publicOnly ? { status: "PUBLISHED" } : {}) },
    orderBy: { updatedAt: "desc" },
    include: { category: true, tags: true },
  })
}

export async function createContent(actor: { id: string }, type: string, input: ContentWriteInput): Promise<Content> {
  const def = requireContentType(type)
  if (!input.title?.trim()) throw new ValidationError("عنوان الزامی است")
  const locale = input.locale ?? "fa"

  if (def.routing.mode === "singleton") {
    const existing = await prisma.content.findFirst({ where: { type }, select: { id: true } })
    if (existing) throw new ConflictError("برای این نوع محتوا فقط یک سند مجاز است")
  }

  const slug = await uniqueSlug(type, locale, input.slug || input.title)
  const data = buildData(def, input) as Prisma.ContentUncheckedCreateInput
  data.type = type
  data.slug = slug
  data.locale = locale
  data.createdById = actor.id
  data.updatedById = actor.id

  const status = input.status ?? "DRAFT"
  data.status = status
  if (status === "PUBLISHED") data.publishedAt = new Date()
  if (status === "SCHEDULED" && input.scheduledFor) data.scheduledFor = new Date(input.scheduledFor)

  if (def.taxonomy.tags && input.tagIds?.length) {
    data.tags = { connect: input.tagIds.map((id) => ({ id })) }
  }

  const content = await prisma.content.create({ data })
  if (input.relations?.length) await syncRelations(content.id, def, input.relations)
  await snapshot(type, content.id, content.body, status === "PUBLISHED" ? "published" : "draft", actor.id)
  return content
}

export async function updateContent(actor: { id: string }, id: string, input: ContentWriteInput): Promise<Content> {
  const existing = await prisma.content.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError("محتوا یافت نشد")
  const def = requireContentType(existing.type)

  const data = buildData(def, input)
  data.updatedById = actor.id
  if (input.slug && input.slug !== existing.slug) {
    data.slug = await uniqueSlug(existing.type, existing.locale, input.slug, id)
  }
  if (def.taxonomy.tags && input.tagIds) {
    data.tags = { set: input.tagIds.map((tid) => ({ id: tid })) }
  }
  if (input.scheduledFor !== undefined) {
    data.scheduledFor = input.scheduledFor ? new Date(input.scheduledFor) : null
  }

  const content = await prisma.content.update({ where: { id }, data })
  if (input.relations) await syncRelations(id, def, input.relations)
  if (input.body !== undefined) await snapshot(existing.type, id, content.body, "revision", actor.id)
  return content
}

export async function transitionStatus(
  actor: { id: string },
  id: string,
  status: ContentStatus,
  scheduledFor?: string | null,
): Promise<Content> {
  const existing = await prisma.content.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError("محتوا یافت نشد")

  const data: Prisma.ContentUncheckedUpdateInput = { status, updatedById: actor.id }
  if (status === "PUBLISHED") {
    data.publishedAt = existing.publishedAt ?? new Date()
    data.scheduledFor = null
  } else if (status === "SCHEDULED") {
    if (!scheduledFor) throw new ValidationError("زمان انتشار الزامی است")
    data.scheduledFor = new Date(scheduledFor)
  }
  const content = await prisma.content.update({ where: { id }, data })
  if (status === "PUBLISHED") await snapshot(existing.type, id, content.body, "published", actor.id)
  return content
}

export async function deleteContent(id: string): Promise<void> {
  const existing = await prisma.content.findUnique({ where: { id }, select: { id: true } })
  if (!existing) throw new NotFoundError("محتوا یافت نشد")
  await prisma.content.delete({ where: { id } })
}
