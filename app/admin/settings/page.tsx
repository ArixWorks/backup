import { Suspense } from "react"
import type { Metadata } from "next"
import { SettingsHub } from "./settings-hub"

export const metadata: Metadata = {
  title: "تنظیمات و پیکربندی | پنل مدیریت",
  description: "مرکز واحد تنظیمات: عمومی، پرداخت، پاداش‌ها، تلگرام، ایمیل، سیستم و ظاهر",
}

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsHub />
    </Suspense>
  )
}
