import { z } from "zod"

/** Shared request schema for content create/update payloads. */
export const relationInputSchema = z.object({
  relationKey: z.string().min(1),
  targetType: z.string().min(1),
  targetId: z.string().min(1),
})

export const contentWriteSchema = z.object({
  title: z.string().trim().min(1, "عنوان الزامی است").max(300),
  slug: z.string().trim().max(120).optional(),
  locale: z.string().trim().max(10).optional(),
  excerpt: z.string().trim().max(500).nullish(),
  body: z.string().max(200_000).optional(),
  status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]).optional(),
  scheduledFor: z.string().datetime().nullish(),

  seoTitle: z.string().trim().max(160).nullish(),
  seoDescription: z.string().trim().max(320).nullish(),
  seoKeywords: z.array(z.string().trim().max(60)).max(20).optional(),
  ogImageUrl: z.string().trim().max(1000).nullish(),
  canonicalUrl: z.string().trim().max(1000).nullish(),
  noindex: z.boolean().optional(),

  coverImageUrl: z.string().trim().max(1000).nullish(),
  order: z.number().int().min(0).max(100000).optional(),
  categoryId: z.string().trim().nullish(),
  tagIds: z.array(z.string().trim()).max(50).optional(),
  /** Free-text tag names; resolved to (or created as) tags server-side. */
  tagNames: z.array(z.string().trim().max(60)).max(50).optional(),

  navShow: z.boolean().optional(),
  navLabel: z.string().trim().max(60).nullish(),
  navIcon: z.string().trim().max(40).nullish(),
  navOrder: z.number().int().min(0).max(10000).optional(),
  navPlacement: z.array(z.enum(["HEADER", "FOOTER", "SIDEBAR"])).max(3).optional(),
  navParentId: z.string().trim().nullish(),
  breadcrumbLabel: z.string().trim().max(80).nullish(),

  fields: z.record(z.string(), z.unknown()).optional(),
  relations: z.array(relationInputSchema).max(100).optional(),
})

export const transitionSchema = z.object({
  status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]),
  scheduledFor: z.string().datetime().nullish(),
})

export const categoryWriteSchema = z.object({
  type: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().max(120).optional(),
  parentId: z.string().trim().nullish(),
  order: z.number().int().min(0).max(100000).optional(),
})

export type ContentWritePayload = z.infer<typeof contentWriteSchema>
