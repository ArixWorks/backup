import { notFound } from "next/navigation"
import { getContentType } from "@/lib/cms/registry"
import { ContentEditor } from "@/components/admin/content/content-editor"
import { serializeTypeDef } from "@/lib/cms/serialize"

export const dynamic = "force-dynamic"

export default async function NewContentPage({
  params,
}: {
  params: Promise<{ type: string }>
}) {
  const { type } = await params
  const def = getContentType(type)
  if (!def) notFound()
  return <ContentEditor def={serializeTypeDef(def)} />
}
