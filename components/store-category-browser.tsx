"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowLeft, ArrowRight, ShoppingBag, Sparkles } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { useI18n } from "@/components/i18n-provider"
import { StoreCatalog } from "@/components/store/store-catalog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

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

      <StoreCatalog />
    </div>
  )
}
