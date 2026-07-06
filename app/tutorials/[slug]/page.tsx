import type { Metadata } from "next"
import { CollectionDetail, collectionDetailMetadata } from "@/components/cms/collection-page"

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  return collectionDetailMetadata("tutorial", slug)
}

export default async function TutorialPage({ params }: Props) {
  const { slug } = await params
  return <CollectionDetail type="tutorial" slug={slug} />
}
