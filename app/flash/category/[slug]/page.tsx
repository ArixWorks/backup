"use client"

import { use } from "react"
import useSWR from "swr"
import { Boxes } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { FlashBrowser } from "@/components/flash-browser"
import { PageHeader } from "@/components/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { useI18n } from "@/components/i18n-provider"

type Category = { id: string; slug: string; name: string; description: string | null }

export default function CategoryProductsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const { t } = useI18n()
  const { data, isLoading } = useSWR<{ data: Category[] }>("/api/v1/flash-sales/categories", fetcher)
  const category = data?.data.find((item) => item.slug === slug)

  if (isLoading) return <Skeleton className="h-44 rounded-2xl" />
  if (!category) return <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">{t("store.categoryEmpty")}</div>

  return <div className="flex flex-col gap-5"><PageHeader icon={Boxes} title={category.name} description={category.description} backHref="/flash" backLabel={t("detail.back")} /><FlashBrowser categorySlug={category.slug} categoryName={category.name} /></div>
}
