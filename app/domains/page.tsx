import { DomainMarketplace } from "@/components/domains/domain-marketplace"
import { createPageMetadata } from "@/lib/seo"

export const dynamic = "force-dynamic"
export const metadata = createPageMetadata({
  title: "جستجو و ثبت دامنه",
  description: "استعلام لحظه‌ای، قیمت شفاف و ثبت امن دامنه با پیگیری کامل سفارش در SubIO.",
  path: "/domains",
})

export default function DomainsPage() {
  return <DomainMarketplace />
}
