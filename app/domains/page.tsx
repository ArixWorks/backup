import type { Metadata } from "next"
import { DomainMarketplace } from "@/components/domains/domain-marketplace"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "جستجو و ثبت دامنه",
  description: "استعلام لحظه‌ای، قیمت شفاف و ثبت امن دامنه با پیگیری کامل سفارش.",
}

export default function DomainsPage() {
  return <DomainMarketplace />
}
