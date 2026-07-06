import type { Metadata } from "next"
import { HelpCircle } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { FaqAccordion } from "@/components/cms/faq-accordion"
import { listPublished } from "@/lib/cms/public"

export const metadata: Metadata = {
  title: "پرسش‌های متداول",
  description: "پاسخ سوالات پرتکرار کاربران درباره خرید، پرداخت، تحویل و پشتیبانی.",
}

export default async function FaqPage() {
  const { items } = await listPublished("faq", { pageSize: 100 })
  return (
    <div className="space-y-6">
      <PageHeader icon={HelpCircle} title="پرسش‌های متداول" description="پاسخ سوالات پرتکرار شما" />
      <FaqAccordion items={items} />
    </div>
  )
}
