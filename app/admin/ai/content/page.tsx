"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, FileText, Search, Tags, Languages, Wand2, Megaphone } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProductDescriptionTool } from "@/components/admin/ai/content/product-description-tool"
import { SeoTool } from "@/components/admin/ai/content/seo-tool"
import { TaxonomyTool } from "@/components/admin/ai/content/taxonomy-tool"
import { TranslateTool } from "@/components/admin/ai/content/translate-tool"
import { RewriteTool } from "@/components/admin/ai/content/rewrite-tool"
import { AnnouncementTool } from "@/components/admin/ai/content/announcement-tool"

const TABS = [
  { id: "product", label: "توضیح محصول", icon: FileText },
  { id: "seo", label: "متن سئو", icon: Search },
  { id: "taxonomy", label: "دسته و برچسب", icon: Tags },
  { id: "translate", label: "ترجمه", icon: Languages },
  { id: "rewrite", label: "بازنویسی", icon: Wand2 },
  { id: "announcement", label: "اعلان و کمپین", icon: Megaphone },
] as const

export default function ContentStudioPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("product")

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6" dir="rtl">
        <header className="flex flex-col gap-2">
          <Link
            href="/admin/ai"
            className="flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowRight className="size-4" />
            بازگشت به تنظیمات هوش مصنوعی
          </Link>
          <h1 className="text-2xl font-bold text-balance">استودیو محتوای هوشمند</h1>
          <p className="text-pretty text-sm text-muted-foreground">
            تولید توضیح محصول، متن سئو، دسته‌بندی، ترجمه چندزبانه و متن کمپین‌ها — همه از طریق هسته مشترک هوش مصنوعی.
          </p>
        </header>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="w-full">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <TabsTrigger key={id} value={id} className="gap-1.5">
                <Icon className="size-4" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="product" className="mt-6">
            <ProductDescriptionTool />
          </TabsContent>
          <TabsContent value="seo" className="mt-6">
            <SeoTool />
          </TabsContent>
          <TabsContent value="taxonomy" className="mt-6">
            <TaxonomyTool />
          </TabsContent>
          <TabsContent value="translate" className="mt-6">
            <TranslateTool />
          </TabsContent>
          <TabsContent value="rewrite" className="mt-6">
            <RewriteTool />
          </TabsContent>
          <TabsContent value="announcement" className="mt-6">
            <AnnouncementTool />
          </TabsContent>
        </Tabs>
    </div>
  )
}
