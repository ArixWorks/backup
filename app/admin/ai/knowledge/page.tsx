import type { Metadata } from "next"
import { KnowledgeManager } from "@/components/admin/ai/knowledge-manager"

export const metadata: Metadata = {
  title: "پایگاه دانش | مدیریت",
  description: "مدیریت اسناد پایگاه دانش برای پاسخ‌گویی هوشمند و جستجوی معنایی",
}

export default function AiKnowledgePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6" dir="rtl">
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-foreground md:text-2xl text-balance">پایگاه دانش</h1>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          اسناد، راهنماها و سوالات متداول را اضافه کنید تا دستیار هوشمند و پشتیبانی از آن‌ها برای
          پاسخ‌گویی دقیق (RAG) استفاده کنند. هر سند به‌صورت خودکار قطعه‌بندی و نمایه‌سازی می‌شود.
        </p>
      </header>
      <KnowledgeManager />
    </div>
  )
}
