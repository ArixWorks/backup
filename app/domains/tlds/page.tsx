import { TldCatalog } from "@/components/domains/tld-catalog"
import { createPageMetadata } from "@/lib/seo"

export const dynamic = "force-dynamic"
export const metadata = createPageMetadata({
  title: "لیست پسوندهای قابل ثبت",
  description: "همه پسوندهای فعال دامنه در SubIO همراه با قیمت ثبت هرکدام؛ پسوند دلخواه را انتخاب و در جعبه جستجو وارد کنید.",
  path: "/domains/tlds",
})

export default function DomainTldsPage() {
  return <TldCatalog />
}
