import { createPageMetadata } from "@/lib/seo"

export const metadata = createPageMetadata({
  title: "مزایده‌های آنلاین",
  description: "در مزایده‌های آنلاین SubIO شرکت کنید، پیشنهادهای زنده را دنبال کنید و محصولات دیجیتال منتخب را امن بخرید.",
  path: "/auctions",
})

export default function AuctionsLayout({ children }: { children: React.ReactNode }) {
  return children
}
