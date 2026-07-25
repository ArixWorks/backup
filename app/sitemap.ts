import type { MetadataRoute } from "next"

const SITE_URL = "https://acciran.com"

const publicRoutes = [
  { path: "", priority: 1, changeFrequency: "daily" as const },
  { path: "/auctions", priority: 0.9, changeFrequency: "hourly" as const },
  { path: "/flash", priority: 0.8, changeFrequency: "hourly" as const },
  { path: "/giveaways", priority: 0.8, changeFrequency: "daily" as const },
  { path: "/articles", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/help", priority: 0.7, changeFrequency: "weekly" as const },
  { path: "/faq", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/domains", priority: 0.7, changeFrequency: "weekly" as const },
  { path: "/vps", priority: 0.6, changeFrequency: "weekly" as const },
  { path: "/rules", priority: 0.4, changeFrequency: "monthly" as const },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return publicRoutes.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }))
}
