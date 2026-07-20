import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CollectionDetail } from "@/components/cms/collection-page"
import { currentUserId } from "@/lib/auth/session"
import { prisma } from "@/lib/db"
import { buildCmsMetadata } from "@/lib/cms/public"

type Props = { params: Promise<{ slug: string }> }

async function getAuthorizedTutorial(slug: string) {
  const userId = await currentUserId()
  if (!userId) return null
  return prisma.content.findFirst({
    where: {
      type: "tutorial",
      slug,
      locale: "fa",
      status: "PUBLISHED",
      attachedToDeliveries: {
        some: {
          status: "DELIVERED",
          order: { userId },
        },
      },
    },
    include: { category: true, tags: true },
  })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const tutorial = await getAuthorizedTutorial(slug)
  if (!tutorial) return { title: "آموزش خرید", robots: { index: false, follow: false } }
  return { ...buildCmsMetadata("tutorial", tutorial), robots: { index: false, follow: false } }
}

export default async function TutorialPage({ params }: Props) {
  const { slug } = await params
  if (!(await getAuthorizedTutorial(slug))) notFound()
  return <CollectionDetail type="tutorial" slug={slug} />
}
