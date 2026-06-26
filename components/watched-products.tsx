"use client"

import Link from "next/link"
import Image from "next/image"
import useSWR from "swr"
import { PackageCheck, PackageX } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { Skeleton } from "@/components/ui/skeleton"
import { useI18n } from "@/components/i18n-provider"

interface WatchedProduct {
  id: string
  slug: string
  title: string
  coverImage: string | null
  price: number
  stock: number
}

export function WatchedProducts() {
  const { priceValue, currency } = useI18n()
  const { data, isLoading } = useSWR<{ data: WatchedProduct[] }>(
    "/api/v1/product-watch",
    fetcher,
    { refreshInterval: 15000 },
  )
  const products = data?.data ?? []

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        محصولی را برای اطلاع از موجودی دنبال نمی‌کنید.
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {products.map((p) => {
        const inStock = p.stock > 0
        return (
          <li key={p.id}>
            <Link
              href={`/flash/${p.id}`}
              className="active:scale-press flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-secondary/40"
            >
              <Image
                src={p.coverImage || "/placeholder.svg"}
                alt=""
                width={56}
                height={56}
                className="h-14 w-14 shrink-0 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <span className="block truncate text-sm font-bold">{p.title}</span>
                <span className="text-gold text-sm font-extrabold tabular-nums">
                  {priceValue(p.price)} <span className="text-[11px] text-muted-foreground">{currency}</span>
                </span>
              </div>
              <span
                className={
                  inStock
                    ? "flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs font-medium text-success"
                    : "flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground"
                }
              >
                {inStock ? <PackageCheck className="h-3.5 w-3.5" /> : <PackageX className="h-3.5 w-3.5" />}
                {inStock ? "موجود" : "ناموجود"}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
