/**
 * Smart internal links.
 *
 * The editor stores internal links as `<a data-ref-type="product"
 * data-ref-id="...">` WITHOUT a hardcoded href. At render time we resolve the
 * ref to the current canonical URL, so links never break if routing changes —
 * only this single map needs updating. The resolver is intentionally pure and
 * synchronous (id → path) so it can run inside the server renderer without an
 * extra DB round-trip.
 */

export type RefType =
  | "product"
  | "auction"
  | "giveaway"
  | "domain"
  | "vps"
  | "article"
  | "faq"
  | "rules"
  | "tutorial"
  | "category"
  | "tag"
  | "user"
  | "page"

export const REF_LABELS: Record<RefType, string> = {
  product: "محصول",
  auction: "مزایده",
  giveaway: "قرعه‌کشی",
  domain: "دامنه",
  vps: "سرور مجازی",
  article: "مقاله",
  faq: "پرسش متداول",
  rules: "قوانین",
  tutorial: "آموزش",
  category: "دسته‌بندی",
  tag: "برچسب",
  user: "کاربر",
  page: "صفحه",
}

/**
 * Resolve a ref to its canonical path. `slugOrId` is whatever the storefront
 * route expects for that entity (products/giveaways use slug; auctions use id).
 * Returns null for types without a public detail page so the renderer can fall
 * back to plain text.
 */
export function resolveRefHref(type: RefType, slugOrId: string): string | null {
  switch (type) {
    case "product":
      return `/flash/${slugOrId}`
    case "auction":
      return `/auctions/${slugOrId}`
    case "giveaway":
      return `/giveaways/${slugOrId}`
    case "domain":
      return `/domains?item=${slugOrId}`
    case "vps":
      return `/vps?item=${slugOrId}`
    case "article":
      return `/articles/${slugOrId}`
    case "faq":
      return `/support/faq#${slugOrId}`
    case "rules":
      return `/rules#${slugOrId}`
    case "tutorial":
      return `/tutorials/${slugOrId}`
    case "category":
      return `/flash?category=${slugOrId}`
    case "tag":
      return `/flash?tag=${slugOrId}`
    case "page":
      return `/${slugOrId}`
    case "user":
      return null // no public profile page
    default:
      return null
  }
}
