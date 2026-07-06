import { notFound } from "next/navigation"
import { getContentType } from "@/lib/cms/registry"
import { ContentListView } from "@/components/admin/content/content-list-view"

export const dynamic = "force-dynamic"

export default async function ContentTypeListPage({
  params,
}: {
  params: Promise<{ type: string }>
}) {
  const { type } = await params
  const def = getContentType(type)
  if (!def) notFound()

  // Serialize only what the client list needs from the registry def.
  return (
    <ContentListView
      typeKey={def.key}
      labelPlural={def.labelPlural}
      labelSingular={def.labelSingular}
      icon={def.icon}
      mode={def.routing.mode}
      listColumns={def.listColumns}
      fields={def.fields.map((f) => ({ key: f.key, label: f.label }))}
    />
  )
}
