import type { Metadata } from "next"

const SITE_URL = "https://acciran.com"
const SOCIAL_IMAGE = "/opengraph-image"

type PageSeo = {
  title: string
  description: string
  path: `/${string}` | "/"
  noindex?: boolean
}

/** Build consistent canonical, Open Graph and Twitter metadata for public pages. */
export function createPageMetadata({ title, description, path, noindex = false }: PageSeo): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: path,
      languages: {
        "fa-IR": path,
        "x-default": path,
      },
    },
    robots: noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "website",
      locale: "fa_IR",
      url: path,
      siteName: "SubIO",
      title,
      description,
      images: [{ url: SOCIAL_IMAGE, width: 1200, height: 630, alt: `${title} — SubIO` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [SOCIAL_IMAGE],
    },
  }
}

export { SITE_URL, SOCIAL_IMAGE }
