import "server-only"

import { createHash, randomUUID } from "node:crypto"
import { Prisma, TranslationStatus } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { runObject } from "@/lib/ai/client"

export const SOURCE_LOCALE = "fa"
export const TARGET_LOCALES = ["en", "ru", "hi"] as const
export type TargetLocale = (typeof TARGET_LOCALES)[number]
export type LocalizableData = Record<string, unknown>

const localeNames: Record<TargetLocale, string> = {
  en: "English",
  ru: "Russian",
  hi: "Hindi",
}

const translatedFieldsSchema = z.object({
  fields: z.array(
    z.object({
      key: z.string(),
      text: z.string(),
    }),
  ),
})

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stable(nested)}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

export function sourceHash(sourceData: LocalizableData): string {
  return createHash("sha256").update(stable(sourceData)).digest("hex")
}

function flattenStrings(value: unknown, path = "$"): Array<{ key: string; text: string }> {
  if (typeof value === "string") return value.trim() ? [{ key: path, text: value }] : []
  if (Array.isArray(value)) return value.flatMap((item, index) => flattenStrings(item, `${path}[${index}]`))
  if (!value || typeof value !== "object") return []
  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) =>
    flattenStrings(nested, `${path}.${key}`),
  )
}

function setPath(target: LocalizableData, path: string, value: string) {
  const parts = path
    .replace(/^\$\.?/, "")
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean)
  let cursor: Record<string, unknown> | unknown[] = target
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index]
    const nextIsIndex = /^\d+$/.test(parts[index + 1])
    const current = Array.isArray(cursor) ? cursor[Number(part)] : cursor[part]
    if (!current || typeof current !== "object") {
      const next = nextIsIndex ? [] : {}
      if (Array.isArray(cursor)) cursor[Number(part)] = next
      else cursor[part] = next
      cursor = next
    } else {
      cursor = current as Record<string, unknown> | unknown[]
    }
  }
  const finalPart = parts.at(-1)
  if (!finalPart) return
  if (Array.isArray(cursor)) cursor[Number(finalPart)] = value
  else cursor[finalPart] = value
}

function rebuildTranslatedData(source: LocalizableData, fields: Array<{ key: string; text: string }>) {
  const translated = structuredClone(source)
  for (const field of fields) setPath(translated, field.key, field.text)
  return translated
}

export async function enqueueTranslations(input: {
  entityType: string
  entityId: string
  sourceData: LocalizableData
}) {
  const hash = sourceHash(input.sourceData)
  await Promise.all(
    TARGET_LOCALES.map((targetLocale) =>
      prisma.contentTranslation.upsert({
        where: {
          entityType_entityId_targetLocale_sourceHash: {
            entityType: input.entityType,
            entityId: input.entityId,
            targetLocale,
            sourceHash: hash,
          },
        },
        create: {
          id: randomUUID(),
          entityType: input.entityType,
          entityId: input.entityId,
          targetLocale,
          sourceHash: hash,
          sourceData: input.sourceData as Prisma.InputJsonValue,
        },
        update: { sourceData: input.sourceData as Prisma.InputJsonValue },
      }),
    ),
  )
  return hash
}

async function claimNextJob() {
  const candidate = await prisma.contentTranslation.findFirst({
    where: {
      status: { in: [TranslationStatus.PENDING, TranslationStatus.FAILED] },
      availableAt: { lte: new Date() },
      attempts: { lt: 5 },
    },
    orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
  })
  if (!candidate) return null

  const claimed = await prisma.contentTranslation.updateMany({
    where: {
      id: candidate.id,
      status: candidate.status,
      attempts: candidate.attempts,
    },
    data: {
      status: TranslationStatus.PROCESSING,
      lockedAt: new Date(),
      attempts: { increment: 1 },
      lastError: null,
    },
  })
  return claimed.count === 1 ? { ...candidate, attempts: candidate.attempts + 1 } : null
}

async function processJob(job: NonNullable<Awaited<ReturnType<typeof claimNextJob>>>) {
  const sourceData = job.sourceData as LocalizableData
  const fields = flattenStrings(sourceData)
  if (fields.length === 0) {
    await prisma.contentTranslation.update({
      where: { id: job.id },
      data: { translatedData: sourceData as Prisma.InputJsonValue, status: TranslationStatus.COMPLETED, completedAt: new Date() },
    })
    return
  }

  try {
    const targetLocale = job.targetLocale as TargetLocale
    const { object, model } = await runObject({
      feature: "content.background_translation",
      tier: "fast",
      schema: translatedFieldsSchema,
      refType: job.entityType,
      refId: job.entityId,
      temperature: 0.1,
      timeoutMs: 45_000,
      system:
        "You are a professional marketplace translator. Preserve meaning, brand names, URLs, HTML tags, markdown, numbers, currencies, placeholders, and technical terminology. Return every input key exactly once. Never add claims or facts.",
      prompt: `Translate every field from Persian into ${localeNames[targetLocale]}. Return natural native copy.\n\n${JSON.stringify({ fields })}`,
    })
    const expectedKeys = new Set(fields.map((field) => field.key))
    if (object.fields.length !== fields.length || object.fields.some((field) => !expectedKeys.has(field.key))) {
      throw new Error("Translation output did not preserve the source field map")
    }
    await prisma.contentTranslation.update({
      where: { id: job.id },
      data: {
        translatedData: rebuildTranslatedData(sourceData, object.fields) as Prisma.InputJsonValue,
        status: TranslationStatus.COMPLETED,
        completedAt: new Date(),
        lockedAt: null,
        model,
      },
    })
  } catch (error) {
    const delayMinutes = Math.min(60, 2 ** job.attempts)
    await prisma.contentTranslation.update({
      where: { id: job.id },
      data: {
        status: TranslationStatus.FAILED,
        lockedAt: null,
        lastError: (error instanceof Error ? error.message : String(error)).slice(0, 1_000),
        availableAt: new Date(Date.now() + delayMinutes * 60_000),
      },
    })
  }
}

export async function processTranslationQueue(limit = 4) {
  let processed = 0
  for (let index = 0; index < limit; index += 1) {
    const job = await claimNextJob()
    if (!job) break
    await processJob(job)
    processed += 1
  }
  const pending = await prisma.contentTranslation.count({
    where: { status: { in: [TranslationStatus.PENDING, TranslationStatus.FAILED] } },
  })
  return { processed, pending }
}

export async function enqueueTranslationBackfill(limit = 12) {
  let queued = 0
  const products = await prisma.product.findMany({
    where: { active: true, hidden: false },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, title: true, description: true, category: true, tags: true, links: true },
  })
  for (const product of products) {
    const hash = sourceHash({
      title: product.title,
      description: product.description,
      category: product.category,
      tags: product.tags,
      links: product.links,
    })
    const existing = await prisma.contentTranslation.count({
      where: { entityType: "product", entityId: product.id, sourceHash: hash },
    })
    if (existing < TARGET_LOCALES.length) {
      await enqueueTranslations({
        entityType: "product",
        entityId: product.id,
        sourceData: {
          title: product.title,
          description: product.description,
          category: product.category,
          tags: product.tags,
          links: product.links,
        },
      })
      queued += 1
    }
  }
  const remaining = Math.max(0, limit - queued)
  if (remaining > 0) {
    const giveaways = await prisma.giveaway.findMany({
      where: { visibility: "PUBLIC" },
      orderBy: { createdAt: "asc" },
      take: remaining,
      select: { id: true, title: true, subtitle: true, description: true, prizeLabel: true },
    })
    for (const giveaway of giveaways) {
      const sourceData = {
        title: giveaway.title,
        subtitle: giveaway.subtitle,
        description: giveaway.description,
        prizeLabel: giveaway.prizeLabel,
      }
      const existing = await prisma.contentTranslation.count({
        where: { entityType: "giveaway", entityId: giveaway.id, sourceHash: sourceHash(sourceData) },
      })
      if (existing < TARGET_LOCALES.length) {
        await enqueueTranslations({ entityType: "giveaway", entityId: giveaway.id, sourceData })
        queued += 1
      }
    }
  }

  const reviewSlots = Math.max(0, limit - queued)
  if (reviewSlots > 0) {
    const reviews = await prisma.review.findMany({
      where: { hidden: false, comment: { not: null } },
      orderBy: { createdAt: "asc" },
      take: reviewSlots,
      select: { id: true, comment: true },
    })
    for (const review of reviews) {
      if (!review.comment?.trim()) continue
      const sourceData = { comment: review.comment }
      const existing = await prisma.contentTranslation.count({
        where: { entityType: "review", entityId: review.id, sourceHash: sourceHash(sourceData) },
      })
      if (existing < TARGET_LOCALES.length) {
        await enqueueTranslations({ entityType: "review", entityId: review.id, sourceData })
        queued += 1
      }
    }
  }

  return { queued }
}

export async function getLocalizedData<T extends LocalizableData>(input: {
  entityType: string
  entityId: string
  locale: string
  fallback: T
}): Promise<T> {
  if (input.locale === SOURCE_LOCALE || !TARGET_LOCALES.includes(input.locale as TargetLocale)) return input.fallback
  const translation = await prisma.contentTranslation.findFirst({
    where: {
      entityType: input.entityType,
      entityId: input.entityId,
      targetLocale: input.locale,
      sourceHash: sourceHash(input.fallback),
      status: TranslationStatus.COMPLETED,
    },
    orderBy: { completedAt: "desc" },
    select: { translatedData: true },
  })
  return (translation?.translatedData as T | null) ?? input.fallback
}
