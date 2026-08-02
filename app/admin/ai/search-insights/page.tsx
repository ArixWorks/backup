import type { Metadata } from "next"
import { SearchInsightsManager } from "@/components/admin/ai/search-insights-manager"

export const metadata: Metadata = {
  title: "تحلیل جستجوها | مدیریت",
  description: "بررسی جستجوهای کاربران، کشف نیازها و محصولاتی که باید به فروشگاه اضافه شوند",
}

export default function AiSearchInsightsPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6" dir="rtl">
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-foreground md:text-2xl text-balance">تحلیل جستجوها</h1>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          ببینید کاربران دنبال چه چیزی می‌گردند. جستجوهای بدون نتیجه، دقیقاً همان محصولاتی هستند که
          مشتری می‌خواهد ولی هنوز نداریم — این‌ها را در اولویت افزودن به فروشگاه قرار دهید.
        </p>
      </header>
      <SearchInsightsManager />
    </div>
  )
}
