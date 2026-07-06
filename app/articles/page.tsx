import type { Metadata } from "next"
import { Newspaper } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { ContentCollection } from "@/components/cms/content-collection"
import { listPublished } from "@/lib/cms/public"

export const metadata: Metadata = {
  title: "مقالات | مجله",
  description: "مقالات و مطالب آموزشی درباره محصولات دیجیتال، امنیت و خرید هوشمند.",
}

export default async function ArticlesPage() {
  const { items } = await listPublished("article")
  return (
    <div className="space-y-6">
      <PageHeader icon={Newspaper} title="مقالات" description="آخرین مطالب و راهنماهای مجله" />
      <ContentCollection items={items} basePath="/articles" />
    </div>
  )
}
