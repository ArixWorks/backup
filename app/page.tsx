import HomePage from "@/components/home-page"
import { createPageMetadata } from "@/lib/seo"

export const metadata = createPageMetadata({
  title: "بازار هوشمند محصولات دیجیتال و مزایده آنلاین",
  description:
    "خرید امن محصولات دیجیتال، شرکت در مزایده‌های آنلاین، تحویل خودکار و مدیریت پرداخت‌ها در تجربه‌ای سریع و حرفه‌ای با SubIO.",
  path: "/",
})

export default function Page() {
  return <HomePage />
}
