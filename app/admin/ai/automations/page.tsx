import type { Metadata } from "next"
import { AutomationsManager } from "@/components/admin/ai/automations-manager"

export const metadata: Metadata = {
  title: "اتوماسیون هوشمند | پنل مدیریت",
  description: "زمان‌بندی و اجرای وظایف خودکار مبتنی بر هوش مصنوعی",
}

export default function AiAutomationsPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6" dir="rtl">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground text-balance">اتوماسیون هوشمند</h1>
        <p className="text-sm text-muted-foreground text-pretty">
          وظایف خودکار مبتنی بر هوش مصنوعی که طبق زمان‌بندی اجرا می‌شوند. همه اجراها ثبت می‌شوند و
          خروجی به‌صورت اعلان برای مدیران ارسال می‌شود؛ هیچ داده‌ای به‌صورت خودکار تغییر نمی‌کند.
        </p>
      </header>
      <AutomationsManager />
    </div>
  )
}
