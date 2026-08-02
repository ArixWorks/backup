"use client"

import { useState } from "react"
import useSWR from "swr"
import { Package, ShoppingBag } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import { EmptyState, SignInRequired } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useI18n } from "@/components/i18n-provider"
import { orderCopy } from "@/lib/i18n/order-copy"
import { ORDER_CATEGORIES, type OrderCategory, type OrderListItem } from "@/lib/orders/shared"
import { OrderCard } from "@/components/orders/order-card"

export default function OrdersPage() {
  const { user } = useSession()
  const { locale } = useI18n()
  const c = orderCopy(locale)
  const [tab, setTab] = useState<OrderCategory>("SHOP")

  const { data, isLoading } = useSWR<{ data: OrderListItem[] }>(user ? "/api/v1/orders" : null, fetcher, {
    refreshInterval: 8000,
  })
  const orders = data?.data ?? []

  if (!user) {
    return <SignInRequired description={c.signInRequired} />
  }

  const byCategory = (cat: OrderCategory) => orders.filter((o) => o.category === cat)

  return (
    <div className="space-y-5">
      <PageHeader icon={Package} title={c.pageTitle} />

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title={c.empty}
          description={c.emptyDesc}
          actionLabel={c.emptyAction}
          actionHref="/flash"
        />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as OrderCategory)}>
          <TabsList className="flex w-full flex-wrap gap-1">
            {ORDER_CATEGORIES.map((cat) => {
              const count = byCategory(cat).length
              return (
                <TabsTrigger key={cat} value={cat} className="flex-1 gap-1.5">
                  {c.categories[cat]}
                  {count > 0 && (
                    <Badge variant="secondary" className="rounded-full px-1.5 text-[10px] leading-none">
                      {count}
                    </Badge>
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>

          {ORDER_CATEGORIES.map((cat) => {
            const list = byCategory(cat)
            return (
              <TabsContent key={cat} value={cat} className="mt-4">
                {cat === "VPS" && list.length === 0 ? (
                  <EmptyState icon={ShoppingBag} title={c.categories.VPS} description={c.vpsSoon} />
                ) : list.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">{c.categoryEmpty}</p>
                ) : (
                  <ul className="space-y-3 web:lg:grid web:lg:grid-cols-2 web:lg:items-start web:lg:gap-3 web:lg:space-y-0">
                    {list.map((o) => (
                      <OrderCard key={o.id} order={o} />
                    ))}
                  </ul>
                )}
              </TabsContent>
            )
          })}
        </Tabs>
      )}
    </div>
  )
}
