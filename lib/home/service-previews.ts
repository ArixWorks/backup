/**
 * Shape of a single item revealed inside a home "service folder".
 *
 * Kept in its own module (rather than in the route handler) so the client
 * folder component can import the type without pulling Prisma and the whole
 * catalog layer into the browser bundle.
 *
 * Everything here is already BigInt-free and locale-agnostic: prices travel as
 * decimal Toman strings and are rendered through `useI18n().price`, which is
 * what makes Persian visitors see Toman and everyone else USD.
 */
export type HomePreviewItem = {
  /** Stable key and animation identity. */
  id: string
  /** Where the preview card navigates. */
  href: string
  /** Primary label — a product title, or the extension itself for domains. */
  label: string
  /** Cover image, or null for domains which render typographically. */
  image: string | null
  /** Price in Toman as a decimal string, or null when there is none to show. */
  priceIrt: string | null
  /** Optional numeric secondary signal (sold units, live bid count). */
  note: string | null
}

/** Full payload returned by `GET /api/v1/home/previews`, keyed by service. */
export type HomePreviews = {
  store: HomePreviewItem[]
  auctions: HomePreviewItem[]
  domains: HomePreviewItem[]
  vps: HomePreviewItem[]
}
