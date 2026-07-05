import type { Metadata } from "next"
import { CopilotChat } from "@/components/admin/ai/copilot-chat"

export const metadata: Metadata = {
  title: "دستیار هوشمند | پنل مدیریت",
  description: "دستیار هوش مصنوعی برای پرسش درباره آمار، محصولات، کاربران و سفارش‌ها",
}

export default function CopilotPage() {
  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] w-full max-w-3xl flex-col gap-4" dir="rtl">
      <header className="space-y-1">
        <h1 className="text-balance text-xl font-bold text-foreground">دستیار هوشمند</h1>
        <p className="text-pretty text-sm text-muted-foreground">
          درباره وضعیت فروشگاه، محصولات، کاربران و سفارش‌ها بپرس. دستیار فقط دسترسی خواندنی دارد.
        </p>
      </header>
      <CopilotChat />
    </div>
  )
}
