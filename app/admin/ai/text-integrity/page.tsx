import type { Metadata } from "next"
import { TextIntegrityManager } from "@/components/admin/ai/text-integrity-manager"

export const metadata: Metadata = {
  title: "سلامت متن فارسی | پنل مدیریت",
  description: "بررسی و تأیید پیشنهادهای اصلاح متن‌های فارسی خراب",
}

export default function TextIntegrityPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6" dir="rtl">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-balance text-foreground">سلامت متن فارسی</h1>
        <p className="max-w-2xl text-sm leading-6 text-pretty text-muted-foreground">
          متن‌های مشکوک هر ۱۰ دقیقه شناسایی می‌شوند. اصلاح دیتابیس فقط پس از تأیید شما اعمال می‌شود و متن‌های داخل کد صرفاً گزارش می‌شوند.
        </p>
      </header>
      <TextIntegrityManager />
    </main>
  )
}
