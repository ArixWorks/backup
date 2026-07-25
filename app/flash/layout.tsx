import { createPageMetadata } from "@/lib/seo"

export const metadata = createPageMetadata({
  title: "فروش ویژه محصولات دیجیتال",
  description: "پیشنهادهای محدود و تخفیف‌های ویژه محصولات دیجیتال را در فروش فوری SubIO پیدا کنید.",
  path: "/flash",
})

export default function FlashLayout({ children }: { children: React.ReactNode }) {
  return children
}
