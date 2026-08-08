"use client"

import { use } from "react"
import useSWR from "swr"
import { fetcher } from "@/lib/api-client"
import { VpsOfferForm, type VpsOfferFormValue } from "@/components/admin/vps/offer-form"

type AdminOfferDTO = {
  id: string
  name: string
  slug: string
  location: string
  cpu: string
  ram: string
  storage: string
  storageType: string
  bandwidth: string
  ipv4: number
  ipv6: boolean
  portSpeed: string | null
  os: string[]
  durationDays: number
  priceIrt: string
  listPriceIrt: string | null
  description: string
  features: unknown
  coverImage: string | null
  gallery: string[]
  stockStatus: string
  estimatedDeliveryText: string | null
  active: boolean
  seoTitle: string | null
  seoDescription: string | null
  seoKeywords: string[]
  ogImageUrl: string | null
  providerCostCents: number | null
  providerLabel: string | null
  backupProviderLabel: string | null
}

function toFormValue(o: AdminOfferDTO): VpsOfferFormValue {
  return {
    id: o.id,
    name: o.name,
    slug: o.slug,
    location: o.location,
    cpu: o.cpu,
    ram: o.ram,
    storage: o.storage,
    storageType: o.storageType,
    bandwidth: o.bandwidth,
    ipv4: o.ipv4,
    ipv6: o.ipv6,
    portSpeed: o.portSpeed ?? "",
    os: o.os,
    durationDays: o.durationDays,
    priceIrt: String(o.priceIrt ?? ""),
    listPriceIrt: o.listPriceIrt ? String(o.listPriceIrt) : "",
    description: o.description ?? "",
    features: Array.isArray(o.features) ? (o.features as string[]) : [],
    coverImage: o.coverImage ?? "",
    gallery: o.gallery ?? [],
    stockStatus: o.stockStatus,
    estimatedDeliveryText: o.estimatedDeliveryText ?? "",
    active: o.active,
    seoTitle: o.seoTitle ?? "",
    seoDescription: o.seoDescription ?? "",
    seoKeywords: o.seoKeywords ?? [],
    ogImageUrl: o.ogImageUrl ?? "",
    providerCostToman: o.providerCostCents != null ? String(o.providerCostCents) : "",
    providerLabel: o.providerLabel ?? "",
    backupProviderLabel: o.backupProviderLabel ?? "",
  }
}

export default function EditVpsOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, isLoading, error } = useSWR<{ ok: boolean; data: AdminOfferDTO }>(
    `/api/v1/admin/vps/offers/${id}`,
    fetcher,
  )

  if (isLoading) {
    return <p className="p-6 text-sm text-muted-foreground">در حال بارگذاری…</p>
  }
  if (error || !data?.data) {
    return <p className="p-6 text-sm text-destructive">پلن یافت نشد یا خطایی رخ داد.</p>
  }
  return <VpsOfferForm initial={toFormValue(data.data)} />
}
