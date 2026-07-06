import type DOMPurifyType from "isomorphic-dompurify"

/**
 * `isomorphic-dompurify` pulls in `jsdom` on the server. Importing it at module
 * top-level means *any* route that merely imports this file (even indirectly,
 * e.g. via a shared Zod schema) evaluates the heavy jsdom dependency at load
 * time — and if that evaluation fails on the serverless runtime the entire
 * route module crashes at import, producing a generic HTML 500 page instead of
 * our JSON errors. Load it lazily so only code paths that actually sanitize
 * pay the cost, and importing this module can never crash a route.
 */
let _purify: typeof DOMPurifyType | null = null
function getDOMPurify(): typeof DOMPurifyType {
  if (_purify) return _purify
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  _purify = require("isomorphic-dompurify").default ?? require("isomorphic-dompurify")
  return _purify as typeof DOMPurifyType
}

/**
 * Rich Content sanitizer — the single source of truth for what HTML is allowed
 * to live in the database and be rendered. Runs identically on the server (RSC
 * renderer, save-time defense in depth) and the client (paste cleaner, pre-save
 * pass) via `isomorphic-dompurify`.
 *
 * The stored format is standard *semantic* HTML. Editor-specific state is only
 * carried on `data-*` attributes and a small, fixed set of class names — never
 * proprietary JSON — so the content stays portable if the editor ever changes.
 */

/** Hosts allowed inside <iframe> embeds (video providers). */
const ALLOWED_IFRAME_HOSTS = [
  "www.youtube.com",
  "youtube.com",
  "www.youtube-nocookie.com",
  "player.vimeo.com",
  "www.aparat.com",
  "aparat.com",
  "t.me",
]

/** Semantic + structural tags allowed at rest. */
const ALLOWED_TAGS = [
  // headings & text
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "br", "hr",
  "strong", "em", "u", "s", "del", "ins", "mark", "sub", "sup", "small", "abbr", "kbd",
  // links
  "a",
  // lists
  "ul", "ol", "li",
  // quotes / callouts / structure
  "blockquote", "section", "aside", "div", "details", "summary",
  // description lists
  "dl", "dt", "dd",
  // media
  "figure", "figcaption", "img", "picture", "source", "video", "audio", "iframe",
  // code
  "pre", "code",
  // tables
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
]

/**
 * Attribute allow-list. `data-*` attributes carry all editor node metadata
 * (callout kind, smart-link refs, template variables, tooltips, embeds …) and
 * are permitted globally by the ADD_ATTR list below.
 */
const ALLOWED_ATTR = [
  "href", "target", "rel", "title", "alt", "src", "srcset", "sizes", "poster",
  "width", "height", "loading", "decoding", "controls", "preload", "muted", "playsinline",
  "colspan", "rowspan", "scope", "headers", "align", "valign", "span",
  "id", "class", "style", "dir", "lang", "role", "aria-label", "aria-hidden", "aria-describedby",
  "allow", "allowfullscreen", "frameborder", "referrerpolicy", "type", "open", "start", "reversed",
  // data-* attributes used by custom nodes:
  "data-type", "data-callout", "data-variant", "data-tooltip", "data-tooltip-pos",
  "data-ref-type", "data-ref-id", "data-ref-label", "data-var", "data-fallback",
  "data-language", "data-highlight-lines", "data-embed", "data-provider", "data-src",
  "data-align", "data-caption", "data-footnote", "data-footnote-id", "data-snippet",
  "data-gallery", "data-blurhash", "data-mention", "data-comment-id",
]

/** Inline CSS properties that survive sanitization (color/format only). */
const ALLOWED_STYLE = /^(color|background-color|text-align|font-weight|font-style|text-decoration|width|height|max-width|aspect-ratio)\s*:/i

let hooksInstalled = false

function installHooks() {
  if (hooksInstalled) return
  hooksInstalled = true

  const DOMPurify = getDOMPurify()

  // Force safe link/target behavior and block non-allowed iframe hosts.
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    const el = node as unknown as Element
    const tag = el.tagName?.toLowerCase()

    if (tag === "a") {
      const href = el.getAttribute("href") ?? ""
      // Allow only http(s), mailto, tel and internal (/...) links.
      if (href && !/^(https?:|mailto:|tel:|\/|#)/i.test(href)) {
        el.removeAttribute("href")
      }
      if (el.getAttribute("target") === "_blank") {
        el.setAttribute("rel", "noopener noreferrer")
      }
    }

    if (tag === "iframe") {
      const src = el.getAttribute("src") ?? ""
      let ok = false
      try {
        ok = ALLOWED_IFRAME_HOSTS.includes(new URL(src).host)
      } catch {
        ok = false
      }
      if (!ok) {
        el.remove()
        return
      }
      el.setAttribute("loading", "lazy")
      el.setAttribute("referrerpolicy", "strict-origin-when-cross-origin")
    }

    // Strip disallowed inline style declarations.
    const style = el.getAttribute?.("style")
    if (style) {
      const safe = style
        .split(";")
        .map((d) => d.trim())
        .filter((d) => d && ALLOWED_STYLE.test(d))
        .join("; ")
      if (safe) el.setAttribute("style", safe)
      else el.removeAttribute("style")
    }
  })
}

const CONFIG: Parameters<typeof DOMPurifyType.sanitize>[1] = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ADD_ATTR: ["target", "allowfullscreen"],
  ALLOW_DATA_ATTR: true,
  FORBID_TAGS: ["script", "style", "form", "input", "textarea", "button", "object", "embed", "link", "meta"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
}

/**
 * Sanitize a rich-content HTML string. Safe to call on the server and client.
 * Always run this on save AND on paste, and again in the renderer.
 */
export function sanitizeRichHtml(html: string): string {
  if (!html) return ""
  installHooks()
  return getDOMPurify().sanitize(html, CONFIG) as unknown as string
}

/** Whether the two allow-lists consider `html` already clean (no-op sanitize). */
export function isCleanRichHtml(html: string): boolean {
  return sanitizeRichHtml(html) === html
}
