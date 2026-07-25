import { CollectionIndex } from "@/components/cms/collection-page"
import { createPageMetadata } from "@/lib/seo"

export const metadata = createPageMetadata({
  title: "مرکز راهنمای SubIO",
  description: "پاسخ سریع و مرحله‌به‌مرحله برای خرید، مزایده، کیف پول، پرداخت و دریافت محصولات دیجیتال در SubIO.",
  path: "/help",
})

export default function HelpPage() {
  return <CollectionIndex type="help" />
}
