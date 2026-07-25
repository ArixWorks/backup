import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "SubIO | بازار هوشمند محصولات دیجیتال",
    short_name: "SubIO",
    description:
      "خرید امن محصولات دیجیتال، مزایده آنلاین و تحویل خودکار در SubIO.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#080f19",
    theme_color: "#080d12",
    lang: "fa-IR",
    dir: "rtl",
    categories: ["shopping", "business", "utilities"],
    icons: [
      {
        src: "/brand/subio-app-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/subio-app-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
