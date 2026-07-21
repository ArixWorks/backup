import { TranslationStatus } from "@prisma/client"
import { prisma } from "../lib/db"
import { sourceHash, TARGET_LOCALES } from "../lib/i18n/content-translation"

type Entity = { entityType: string; entityId: string; sourceData: Record<string, unknown> }

async function main() {
  const [contents, products, giveaways] = await Promise.all([
    prisma.content.findMany({ where: { locale: "fa", status: "PUBLISHED" } }),
    prisma.product.findMany({ where: { active: true, hidden: false }, select: { id: true, title: true, description: true, category: true, tags: true, links: true } }),
    prisma.giveaway.findMany({ where: { visibility: "PUBLIC" }, select: { id: true, title: true, subtitle: true, description: true, prizeLabel: true } }),
  ])

  const entities: Entity[] = [
    ...contents.map((content) => ({
      entityType: `content:${content.type}`,
      entityId: content.id,
      sourceData: { title: content.title, excerpt: content.excerpt, body: content.body, seoTitle: content.seoTitle, seoDescription: content.seoDescription, seoKeywords: content.seoKeywords, fields: content.fields, navLabel: content.navLabel, breadcrumbLabel: content.breadcrumbLabel },
    })),
    ...products.map((product) => ({ entityType: "product", entityId: product.id, sourceData: { title: product.title, description: product.description, category: product.category, tags: product.tags, links: product.links } })),
    ...giveaways.map((giveaway) => ({ entityType: "giveaway", entityId: giveaway.id, sourceData: { title: giveaway.title, subtitle: giveaway.subtitle, description: giveaway.description, prizeLabel: giveaway.prizeLabel } })),
  ]

  const missing: Array<{ entityType: string; entityId: string; locales: string[] }> = []
  for (const entity of entities) {
    const rows = await prisma.contentTranslation.findMany({
      where: { entityType: entity.entityType, entityId: entity.entityId, sourceHash: sourceHash(entity.sourceData), status: TranslationStatus.COMPLETED },
      select: { targetLocale: true },
    })
    const completed = new Set(rows.map((row) => row.targetLocale))
    const locales = TARGET_LOCALES.filter((locale) => !completed.has(locale))
    if (locales.length > 0) missing.push({ entityType: entity.entityType, entityId: entity.entityId, locales: [...locales] })
  }

  console.log(JSON.stringify({ checked: entities.length, complete: entities.length - missing.length, missing }, null, 2))
  if (missing.length > 0) process.exitCode = 1
}

main().finally(() => prisma.$disconnect())
