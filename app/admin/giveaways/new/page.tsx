"use client"

import Link from "next/link"
import { ChevronRight, Gift } from "lucide-react"
import { GiveawayForm, emptyGiveaway } from "@/components/admin/giveaway-form"

export default function NewGiveawayPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/giveaways" className="hover:text-foreground">
          قرعه‌کشی‌ها
        </Link>
        <ChevronRight className="h-4 w-4 rotate-180" />
        <span className="text-foreground">قرعه‌کشی جدید</span>
      </div>
      <div className="flex items-center gap-2">
        <Gift className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-extrabold">ساخت قرعه‌کشی</h1>
      </div>
      <GiveawayForm initial={emptyGiveaway} />
    </div>
  )
}
