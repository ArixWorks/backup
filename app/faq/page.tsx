import { HelpCircle } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { FaqAccordion } from "@/components/cms/faq-accordion"
import { listPublished } from "@/lib/cms/public"
import { getRequestLocale, serverCopy } from "@/lib/i18n/server"

export default async function FaqPage() {
  const [{ items }, locale] = await Promise.all([
    listPublished("faq", { pageSize: 100 }),
    getRequestLocale(),
  ])
  return (
    <div className="space-y-6">
      <PageHeader
        icon={HelpCircle}
        title={serverCopy("faq", locale)}
        description={serverCopy("faqDescription", locale)}
      />
      <FaqAccordion items={items} />
    </div>
  )
}
