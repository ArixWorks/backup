import { CollectionIndex } from "@/components/cms/collection-page"
import { createPageMetadata } from "@/lib/seo"

export const metadata = createPageMetadata({
  title: "مقالات و راهنمای خرید محصولات دیجیتال",
  description: "راهنماها، بررسی‌ها و آموزش‌های کاربردی SubIO برای انتخاب و استفاده بهتر از محصولات و سرویس‌های دیجیتال.",
  path: "/articles",
})

export default function ArticlesPage() {
  return <CollectionIndex type="article" />
}
