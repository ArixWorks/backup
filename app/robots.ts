import type { MetadataRoute } from "next"

const SITE_URL = "https://acciran.com"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/api/",
        "/account/",
        "/orders/",
        "/wallet/",
        "/profile/",
        "/notifications/",
        "/support/",
        "/reports/",
        "/refunds/",
        "/watchlist/",
        "/login",
        "/forgot-password",
        "/reset-password",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
