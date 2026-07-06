/**
 * Dynamic Variables / Template Placeholders.
 *
 * A single catalog powers BOTH the editor autocomplete (what the admin can
 * insert) and the render-time resolver (what the reader sees). Variables are
 * stored in the HTML as a semantic span:
 *
 *   <span data-var="product.name" data-fallback="محصول">محصول</span>
 *
 * That keeps the raw HTML valid, SEO-safe and readable even before resolution.
 * At render time `<RichContent>` swaps in the real value from a supplied
 * context object, falling back to `data-fallback` when a value is missing.
 *
 * This module is isomorphic (no server-only imports) so the editor can import
 * the catalog directly.
 */

export type VariableKey =
  | "site.name"
  | "site.url"
  | "site.supportEmail"
  | "today"
  | "now"
  | "user.name"
  | "user.email"
  | "wallet.balance"
  | "product.name"
  | "product.price"
  | "product.url"
  | "auction.title"
  | "auction.end"
  | "auction.currentPrice"
  | "giveaway.title"
  | "giveaway.drawAt"
  | "discount.code"
  | "discount.amount"
  | "order.id"
  | "order.amount"

export interface VariableDef {
  key: VariableKey
  /** Namespace used for grouping in the autocomplete UI. */
  group: string
  /** Human label shown in the picker (Persian). */
  label: string
  /** Example rendered value, also used as default fallback text. */
  sample: string
}

export const VARIABLE_CATALOG: VariableDef[] = [
  { key: "site.name", group: "سایت", label: "نام سایت", sample: "ساب‌آی‌او" },
  { key: "site.url", group: "سایت", label: "آدرس سایت", sample: "https://subio.app" },
  { key: "site.supportEmail", group: "سایت", label: "ایمیل پشتیبانی", sample: "support@subio.app" },
  { key: "today", group: "تاریخ", label: "تاریخ امروز", sample: "۱۴۰۴/۰۴/۱۵" },
  { key: "now", group: "تاریخ", label: "زمان کنونی", sample: "۱۴:۳۰" },
  { key: "user.name", group: "کاربر", label: "نام کاربر", sample: "کاربر گرامی" },
  { key: "user.email", group: "کاربر", label: "ایمیل کاربر", sample: "user@mail.com" },
  { key: "wallet.balance", group: "کیف‌پول", label: "موجودی کیف‌پول", sample: "۰ تومان" },
  { key: "product.name", group: "محصول", label: "نام محصول", sample: "نام محصول" },
  { key: "product.price", group: "محصول", label: "قیمت محصول", sample: "۰ تومان" },
  { key: "product.url", group: "محصول", label: "لینک محصول", sample: "#" },
  { key: "auction.title", group: "مزایده", label: "عنوان مزایده", sample: "عنوان مزایده" },
  { key: "auction.end", group: "مزایده", label: "زمان پایان مزایده", sample: "—" },
  { key: "auction.currentPrice", group: "مزایده", label: "قیمت فعلی مزایده", sample: "۰ تومان" },
  { key: "giveaway.title", group: "قرعه‌کشی", label: "عنوان قرعه‌کشی", sample: "عنوان قرعه‌کشی" },
  { key: "giveaway.drawAt", group: "قرعه‌کشی", label: "زمان قرعه‌کشی", sample: "—" },
  { key: "discount.code", group: "تخفیف", label: "کد تخفیف", sample: "CODE" },
  { key: "discount.amount", group: "تخفیف", label: "مقدار تخفیف", sample: "۰ تومان" },
  { key: "order.id", group: "سفارش", label: "شناسه سفارش", sample: "#000" },
  { key: "order.amount", group: "سفارش", label: "مبلغ سفارش", sample: "۰ تومان" },
]

const CATALOG_MAP = new Map(VARIABLE_CATALOG.map((v) => [v.key, v]))

export function getVariableDef(key: string): VariableDef | undefined {
  return CATALOG_MAP.get(key as VariableKey)
}

/**
 * Resolution context. Provide any subset; missing values fall back to the
 * placeholder's own `data-fallback` text (or the catalog sample).
 */
export type VariableContext = Partial<Record<VariableKey, string | number | null | undefined>>

/** Resolve a single variable key against a context. Returns `undefined` when unset. */
export function resolveVariable(key: string, ctx: VariableContext): string | undefined {
  const raw = ctx[key as VariableKey]
  if (raw === null || raw === undefined || raw === "") return undefined
  return String(raw)
}

/**
 * Resolve every `<span data-var="...">` inside an HTML string. Pure string
 * transformation so it runs safely in RSC without a DOM. Escapes resolved
 * values to keep output safe.
 */
export function resolveVariablesInHtml(html: string, ctx: VariableContext): string {
  if (!html || !html.includes("data-var")) return html
  return html.replace(
    /<span([^>]*?)data-var="([^"]+)"([^>]*)>([\s\S]*?)<\/span>/g,
    (match, pre: string, key: string, post: string, inner: string) => {
      const value = resolveVariable(key, ctx)
      const fallbackMatch = /data-fallback="([^"]*)"/.exec(pre + post)
      const fallback = fallbackMatch?.[1]
      const text = value ?? fallback ?? inner ?? getVariableDef(key)?.sample ?? key
      return `<span${pre}data-var="${key}"${post}>${escapeHtml(text)}</span>`
    },
  )
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}
