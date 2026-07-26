"use client"

import { ShoppingBag } from "lucide-react"
import { FlashBrowser } from "@/components/flash-browser"
import { PageHeader } from "@/components/page-header"
import { useI18n } from "@/components/i18n-provider"

export default function AllProductsPage() {
  const { t } = useI18n()
  return <div className="flex flex-col gap-5"><PageHeader icon={ShoppingBag} title={t("store.allProducts")} description={t("store.allProductsHint")} backHref="/flash" backLabel={t("detail.back")} /><FlashBrowser /></div>
}
