"use client"

import Link from "next/link"
import useSWR from "swr"
import { ArrowLeft, Boxes, PackageOpen, ShoppingBag } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { useI18n } from "@/components/i18n-provider"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type Category = { id: string; slug: string; name: string; description: string | null; count: number }

export function StoreCategoryBrowser() {
  const { data, isLoading } = useSWR<{ data: Category[] }>("/api/v1/flash-sales/categories", fetcher)
  const { num, t } = useI18n()

  if (isLoading) return <div className="grid gap-3 sm:grid-cols-2 web:lg:grid-cols-3">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-36 rounded-2xl" />)}</div>

  return (
    <div className="flex flex-col gap-4">
      <Link href="/flash/all" className="group flex min-h-24 items-center justify-between gap-4 rounded-2xl border border-primary/25 bg-primary/10 p-4 transition-colors hover:bg-primary/15">
        <div className="flex items-center gap-3"><span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground"><ShoppingBag className="size-6" /></span><div><h2 className="font-bold">{t("store.allProducts")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("store.allProductsHint")}</p></div></div>
        <ArrowLeft className="size-5 shrink-0 text-primary transition-transform group-hover:-translate-x-1 rtl:rotate-180 rtl:group-hover:translate-x-1" />
      </Link>

      {(data?.data.length ?? 0) > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 web:lg:grid-cols-3">
          {data?.data.map((category) => {
            const empty = category.count === 0
            return (
              <Link key={category.id} href={`/flash/category/${category.slug}`} className="group block">
                <Card className={cn("h-full overflow-hidden transition-colors hover:border-primary/40", empty && "grayscale opacity-65")}>
                  <CardContent className="flex min-h-36 flex-col justify-between gap-5 p-4">
                    <div className="flex items-start justify-between gap-3"><span className={cn("flex size-11 items-center justify-center rounded-xl", empty ? "bg-muted text-muted-foreground" : "bg-secondary text-primary")}><Boxes className="size-5" /></span><ArrowLeft className="size-4 text-muted-foreground transition-transform group-hover:-translate-x-1 rtl:rotate-180 rtl:group-hover:translate-x-1" /></div>
                    <div><h2 className="text-base font-bold">{category.name}</h2>{category.description && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{category.description}</p>}<p className="mt-2 text-xs font-medium text-primary">{num(category.count)} {t("store.productsCount")}</p></div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border text-center"><PackageOpen className="size-8 text-muted-foreground" /><p className="text-sm text-muted-foreground">{t("store.noCategories")}</p></div>
      )}
    </div>
  )
}
