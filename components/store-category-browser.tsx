"use client"

import { useRef } from "react"
import Link from "next/link"
import useSWR from "swr"
import { ArrowLeft, ArrowRight, Boxes, PackageOpen, ShoppingBag, Sparkles } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { useI18n } from "@/components/i18n-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type Category = { id: string; slug: string; name: string; description: string | null; count: number }
type FeaturedProduct = {
  id: string
  slug: string
  title: string
  description: string | null
  category: string | null
  coverImage: string | null
  price: string | number
  compareAtPrice: string | number | null
  stock: number
}

const categoryScenes = ["orbit", "mesh", "signal", "prism"] as const

export function StoreCategoryBrowser() {
  const { locale, num, price, t } = useI18n()
  const sliderRef = useRef<HTMLDivElement>(null)
  const { data, isLoading } = useSWR<{ data: Category[] }>("/api/v1/flash-sales/categories", fetcher)
  const { data: featuredData, isLoading: featuredLoading } = useSWR<{ data: FeaturedProduct[] }>(`/api/v1/flash-sales/featured?locale=${locale}`, fetcher)
  const featured = featuredData?.data ?? []

  function scrollSlider(direction: number) {
    sliderRef.current?.scrollBy({ left: direction * sliderRef.current.clientWidth, behavior: "smooth" })
  }

  return (
    <div className="flex flex-col gap-7">
      {featuredLoading ? (
        <Skeleton className="aspect-[4/3] w-full rounded-3xl sm:aspect-[16/7]" />
      ) : featured.length > 0 ? (
        <section aria-labelledby="featured-products-title" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" aria-hidden="true" />
              <h2 id="featured-products-title" className="text-lg font-extrabold">{t("store.featuredTitle")}</h2>
            </div>
            {featured.length > 1 && (
              <div className="flex gap-2" dir="ltr">
                <Button variant="outline" size="icon-sm" onClick={() => scrollSlider(-1)} aria-label={t("store.previousSlide")}><ArrowLeft /></Button>
                <Button variant="outline" size="icon-sm" onClick={() => scrollSlider(1)} aria-label={t("store.nextSlide")}><ArrowRight /></Button>
              </div>
            )}
          </div>
          <div ref={sliderRef} className="flex snap-x snap-mandatory overflow-x-auto rounded-3xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" dir="ltr">
            {featured.map((product, index) => (
              <article key={product.id} className="relative aspect-[4/3] min-w-full snap-center overflow-hidden rounded-3xl bg-foreground text-background sm:aspect-[16/7]" dir={locale === "fa" ? "rtl" : "ltr"}>
                {product.coverImage ? (
                  <img src={product.coverImage} alt="" className="absolute inset-0 size-full object-cover opacity-55" crossOrigin="anonymous" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-primary/80" aria-hidden="true">
                    <div className="flex size-36 rotate-6 items-center justify-center rounded-[2.5rem] border border-primary-foreground/30 bg-primary-foreground/10 sm:size-48">
                      <ShoppingBag className="size-16 text-primary-foreground/80 sm:size-20" />
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 bg-foreground/45" aria-hidden="true" />
                <div className="relative flex size-full flex-col justify-end gap-3 p-5 sm:max-w-2xl sm:p-8">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{t("store.featuredBadge")}</Badge>
                    {product.category && <span className="text-xs text-background/75">{product.category}</span>}
                  </div>
                  <h3 className="max-w-xl text-balance text-2xl font-black leading-tight sm:text-4xl">{product.title}</h3>
                  {product.description && <p className="line-clamp-2 max-w-xl text-sm leading-relaxed text-background/80 sm:text-base">{product.description.replace(/<[^>]*>/g, " ")}</p>}
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-background/70">{product.stock > 0 ? t("store.inStock") : t("store.outOfStock")}</span>
                      <strong className="text-lg sm:text-xl">{price(product.price)}</strong>
                    </div>
                    <Button render={<Link href={`/flash/${product.slug}`} />} size="lg" disabled={product.stock <= 0}>
                      {t("store.viewProduct")}<ArrowLeft data-icon="inline-end" className="rtl:rotate-180" />
                    </Button>
                  </div>
                </div>
                <span className="absolute end-5 top-5 text-xs font-medium text-background/70">{num(index + 1)} / {num(featured.length)}</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="store-categories-title" className="flex flex-col gap-4">
        <div>
          <h2 id="store-categories-title" className="text-xl font-extrabold">{t("store.categoriesTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("store.categoriesHint")}</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 web:xl:grid-cols-3">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-32 rounded-3xl" />)}</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 web:xl:grid-cols-3">
            <Link href="/flash/all" className="group col-span-full flex min-h-28 items-center justify-between gap-3 overflow-hidden rounded-3xl border border-primary/30 bg-primary/10 p-4 outline-none transition-[background-color,border-color,transform] focus-visible:ring-2 focus-visible:ring-ring hoverable:hover:-translate-y-0.5 hoverable:hover:border-primary/50 hoverable:hover:bg-primary/15 sm:p-5">
              <div className="flex min-w-0 items-center gap-3 sm:gap-4"><span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md sm:size-14"><ShoppingBag className="size-6" aria-hidden="true" /></span><div className="min-w-0"><h3 className="text-base font-extrabold sm:text-lg">{t("store.allProducts")}</h3><p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">{t("store.allProductsHint")}</p></div></div>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-background/40 text-primary"><ArrowLeft className="size-5 transition-transform group-hover:-translate-x-1 rtl:rotate-180 rtl:group-hover:translate-x-1" aria-hidden="true" /></span>
            </Link>

            {(data?.data.length ?? 0) > 0 ? data?.data.map((category, index) => {
              const empty = category.count === 0
              const scene = categoryScenes[index % categoryScenes.length]
              return (
                <Link
                  key={category.id}
                  href={`/flash/category/${category.slug}`}
                  className={cn("store-category group relative isolate block min-h-32 overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-md outline-none transition-[transform,border-color,box-shadow] duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background hoverable:hover:-translate-y-1 hoverable:hover:border-primary/40 hoverable:hover:shadow-lg", empty && "opacity-60")}
                  data-scene={scene}
                >
                  <span className="store-category__field" aria-hidden="true" />
                  <span className="store-category__orbit" aria-hidden="true"><span /></span>
                  <span className="store-category__scan" aria-hidden="true" />
                  <div className="relative z-10 flex min-h-32 items-center gap-3 p-4 sm:min-h-36 sm:gap-4 sm:p-5">
                    <span className="store-category__icon flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-background/65 text-primary shadow-sm backdrop-blur-md sm:size-14">
                      <Boxes className="size-5 sm:size-6" aria-hidden="true" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <h3 dir="auto" className="line-clamp-2 text-pretty text-base font-black leading-6 sm:text-lg">{category.name}</h3>
                      <p className="text-xs font-semibold text-muted-foreground">{num(category.count)} {t("store.productsCount")}</p>
                    </div>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-foreground/10 bg-background/55 text-foreground backdrop-blur-md transition-transform duration-300 group-hover:-translate-x-1 rtl:group-hover:translate-x-1">
                      <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              )
            }) : (
              <div className="col-span-full flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border text-center"><PackageOpen className="size-8 text-muted-foreground" /><p className="text-sm text-muted-foreground">{t("store.noCategories")}</p></div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
