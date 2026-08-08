"use client"

import { VpsOfferForm, EMPTY_OFFER } from "@/components/admin/vps/offer-form"

export default function NewVpsOfferPage() {
  return <VpsOfferForm initial={EMPTY_OFFER} />
}
