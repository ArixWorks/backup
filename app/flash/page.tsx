"use client"

import { ShoppingBag } from "lucide-react"
import { StoreCategoryBrowser } from "@/components/store-category-browser"
import { PageHeader } from "@/components/page-header"
import { useI18n } from "@/components/i18n-provider"

export default function FlashPage() {
  const { t } = useI18n()
  return <div className="flex flex-col gap-5"><PageHeader icon={ShoppingBag} title={t("flash.title")} description={t("store.categoriesHint")} /><StoreCategoryBrowser /></div>
}
