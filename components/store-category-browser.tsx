"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowLeft, ArrowRight, Boxes, PackageOpen, ShoppingBag, Sparkles } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { useI18n } from "@/components/i18n-provider"
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

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "18%" : "-18%",
    rotateY: direction > 0 ? -10 : 10,
    scale: 0.96,
    opacity: 0,
  }),
  center: { x: 0, rotateY: 0, scale: 1, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? "-12%" : "12%",
    rotateY: direction > 0 ? 8 : -8,
    scale: 0.98,
    opacity: 0,
  }),
}

type FeaturedSliderProps = {
  featured: FeaturedProduct[]
  activeSlide: number
  direction: number
  reduceMotion: boolean
  locale: string
  num: (value: number) => string
  t: (key: "store.featuredTitle" | "store.previousSlide" | "store.nextSlide" | "store.viewProduct") => string
  onNext: () => void
  onPrev: () => void
  onSelect: (index: number) => void
  onPauseChange: (paused: boolean) => void
}

function FeaturedSlider({ featured, activeSlide, direction, reduceMotion, locale, num, t, onNext, onPrev, onSelect, onPauseChange }: FeaturedSliderProps) {
  const product = featured[activeSlide]

  return (
    <section aria-labelledby="featured-products-title" className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Sparkles className="size-5 text-primary" aria-hidden="true" />
        <h2 id="featured-products-title" className="text-lg font-extrabold">{t("store.featuredTitle")}</h2>
      </div>

      <div
        className="group relative isolate aspect-[16/10] touch-pan-y overflow-hidden rounded-[2rem] border border-border bg-muted shadow-xl [perspective:1200px] sm:aspect-[21/8]"
        dir="ltr"
      >
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.article
            key={product.id}
            custom={direction}
            variants={reduceMotion ? undefined : slideVariants}
            initial={reduceMotion ? { opacity: 0 } : "enter"}
            animate={reduceMotion ? { opacity: 1 } : "center"}
            exit={reduceMotion ? { opacity: 0 } : "exit"}
            transition={{ duration: reduceMotion ? 0.18 : 0.6, ease: [0.22, 1, 0.36, 1] }}
            drag={featured.length > 1 && !reduceMotion ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.12}
            onDragStart={() => onPauseChange(true)}
            onDragEnd={(_, info) => {
              onPauseChange(false)
              if (info.offset.x < -55 || info.velocity.x < -450) onNext()
              else if (info.offset.x > 55 || info.velocity.x > 450) onPrev()
            }}
            className="absolute inset-0 overflow-hidden rounded-[inherit] bg-muted [transform-style:preserve-3d]"
            dir={locale === "fa" ? "rtl" : "ltr"}
          >
            {product.coverImage ? (
              <motion.img
                src={product.coverImage}
                alt=""
                crossOrigin="anonymous"
                draggable={false}
                className="pointer-events-none absolute inset-0 size-full select-none object-cover"
                initial={reduceMotion ? false : { scale: 1.08 }}
                animate={{ scale: 1 }}
                transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-primary" aria-hidden="true">
                <ShoppingBag className="size-28 text-primary-foreground/80 sm:size-36" />
              </div>
            )}
            <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.9),rgba(0,0,0,0.35)_55%,rgba(0,0,0,0.15))]" aria-hidden="true" />

            <div className="relative flex size-full flex-col items-center justify-end gap-3 px-5 pb-7 pt-6 text-center sm:pb-8">
              <motion.h3
                initial={reduceMotion ? false : { y: 14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: reduceMotion ? 0 : 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="line-clamp-1 max-w-md text-balance text-base font-extrabold leading-snug text-white drop-shadow-lg sm:text-2xl"
                dir={locale === "fa" ? "rtl" : "ltr"}
              >
                {product.title}
              </motion.h3>
              <motion.div
                className="w-full max-w-xs"
                initial={reduceMotion ? false : { y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: reduceMotion ? 0 : 0.25, duration: 0.45 }}
              >
                <Button
                  render={<Link href={`/flash/${product.slug}`} />}
                  size="sm"
                  className="h-9 w-full rounded-full border border-white/25 bg-white/15 text-sm font-semibold text-white shadow-md backdrop-blur-md hover:bg-white/25"
                >
                  {t("store.viewProduct")}<ArrowLeft data-icon="inline-end" className="rtl:rotate-180" />
                </Button>
              </motion.div>
            </div>
          </motion.article>
        </AnimatePresence>

        {featured.length > 1 && (
          <>
            <div className="pointer-events-none absolute inset-x-3 top-1/2 z-20 hidden -translate-y-1/2 justify-between opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 sm:flex" dir="ltr">
              <Button variant="secondary" size="icon-sm" className="pointer-events-auto rounded-full bg-black/45 text-white shadow-lg backdrop-blur-md hover:bg-black/65" onClick={onPrev} aria-label={t("store.previousSlide")}><ArrowLeft /></Button>
              <Button variant="secondary" size="icon-sm" className="pointer-events-auto rounded-full bg-black/45 text-white shadow-lg backdrop-blur-md hover:bg-black/65" onClick={onNext} aria-label={t("store.nextSlide")}><ArrowRight /></Button>
            </div>
            <div className="absolute inset-x-0 bottom-2.5 z-20 flex items-center justify-center gap-2" dir="ltr">
              {featured.map((item, index) => (
                <button key={item.id} type="button" onClick={() => onSelect(index)} className={cn("h-1.5 rounded-full bg-white/50 transition-[width,background-color] duration-300", index === activeSlide ? "w-6 bg-white" : "w-1.5")} aria-label={`${t(index < activeSlide ? "store.previousSlide" : "store.nextSlide")} ${num(index + 1)}`} aria-current={index === activeSlide ? "true" : undefined} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

export function StoreCategoryBrowser() {
  const { locale, num, t } = useI18n()
  const reduceMotion = useReducedMotion()
  const [activeSlide, setActiveSlide] = useState(0)
  const [slideDirection, setSlideDirection] = useState(1)
  const [sliderPaused, setSliderPaused] = useState(false)
  const { data, isLoading } = useSWR<{ data: Category[] }>("/api/v1/flash-sales/categories", fetcher)
  const { data: featuredData, isLoading: featuredLoading } = useSWR<{ data: FeaturedProduct[] }>(`/api/v1/flash-sales/featured?locale=${locale}`, fetcher)
  const featured = featuredData?.data ?? []

  const changeSlide = useCallback((direction: number) => {
    if (featured.length < 2) return
    setSlideDirection(direction)
    setActiveSlide((current) => (current + direction + featured.length) % featured.length)
  }, [featured.length])

  useEffect(() => {
    if (reduceMotion || sliderPaused || featured.length < 2) return
    const timer = window.setInterval(() => changeSlide(1), 6000)
    return () => window.clearInterval(timer)
  }, [changeSlide, featured.length, reduceMotion, sliderPaused])

  useEffect(() => {
    if (activeSlide >= featured.length) setActiveSlide(0)
  }, [activeSlide, featured.length])

  return (
    <div className="flex flex-col gap-7">
      {featuredLoading ? (
        <Skeleton className="aspect-[16/10] w-full rounded-[2rem] sm:aspect-[21/8]" />
      ) : featured.length > 0 ? (
        <FeaturedSlider
          featured={featured}
          activeSlide={Math.min(activeSlide, featured.length - 1)}
          direction={slideDirection}
          reduceMotion={Boolean(reduceMotion)}
          locale={locale}
          num={num}
          t={t}
          onNext={() => changeSlide(1)}
          onPrev={() => changeSlide(-1)}
          onSelect={(index) => {
            setSlideDirection(index > activeSlide ? 1 : -1)
            setActiveSlide(index)
          }}
          onPauseChange={setSliderPaused}
        />
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
