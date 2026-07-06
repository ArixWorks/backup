import { notFound } from "next/navigation"
import { getContentType } from "@/lib/cms/registry"
import { getContent } from "@/lib/cms/content"
import { resolveRelations } from "@/lib/cms/relations"
import { ContentEditor } from "@/components/admin/content/content-editor"
import { serializeTypeDef } from "@/lib/cms/serialize"

export const dynamic = "force-dynamic"

export default async function EditContentPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>
}) {
  const { type, id } = await params
  const def = getContentType(type)
  if (!def) notFound()

  const content = await getContent(id).catch(() => null)
  if (!content || content.type !== type) notFound()

  const resolved = await resolveRelations(id)
  // Map resolved targets (with labels/thumbs) back onto relation rows.
  const labelFor = new Map<string, { label: string; thumb: string | null }>()
  for (const targets of Object.values(resolved)) {
    for (const t of targets) labelFor.set(`${t.targetType}:${t.targetId}`, { label: t.label, thumb: t.thumb })
  }

  const initial = {
    id: content.id,
    title: content.title,
    slug: content.slug,
    excerpt: content.excerpt,
    body: content.body,
    status: content.status,
    scheduledFor: content.scheduledFor ? content.scheduledFor.toISOString() : null,
    seoTitle: content.seoTitle,
    seoDescription: content.seoDescription,
    seoKeywords: content.seoKeywords ?? [],
    coverImageUrl: content.coverImageUrl,
    fields: (content.fields as Record<string, unknown> | null) ?? {},
    navShow: content.navShow,
    navLabel: content.navLabel,
    navIcon: content.navIcon,
    navOrder: content.navOrder,
    navPlacement: content.navPlacement ?? [],
    breadcrumbLabel: content.breadcrumbLabel,
    relations: content.relations.map((r) => {
      const meta = labelFor.get(`${r.targetType}:${r.targetId}`)
      return {
        targetType: r.targetType,
        targetId: r.targetId,
        relationKey: r.relationKey,
        order: r.order,
        label: meta?.label,
        thumb: meta?.thumb ?? null,
      }
    }),
    tags: content.tags.map((t) => ({ id: t.id, name: t.name })),
  }

  return <ContentEditor def={serializeTypeDef(def)} contentId={id} initial={initial} />
}
