import { createPageMetadata } from "@/lib/seo"

export const metadata = createPageMetadata({
  title: "جوایز و قرعه‌کشی‌ها",
  description: "در کمپین‌های جایزه و قرعه‌کشی‌های SubIO شرکت کنید و شانس دریافت محصولات و اعتبار دیجیتال داشته باشید.",
  path: "/giveaways",
})

export default function GiveawaysLayout({ children }: { children: React.ReactNode }) {
  return children
}
