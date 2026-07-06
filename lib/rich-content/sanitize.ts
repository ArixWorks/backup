import sanitizeHtml from "sanitize-html"

/**
 * Rich Content sanitizer — the single source of truth for what HTML is allowed
 * to live in the database and be rendered. Runs identically on the server (RSC
 * renderer, save-time defense in depth) and the client (paste cleaner, pre-save
 * pass).
 *
 * Implemented with `sanitize-html` (a pure-JS parser, no `jsdom`). The previous
 * implementation used `isomorphic-dompurify`, which pulls in `jsdom` on the
 * server; on the Vercel serverless runtime that dependency chain includes
 * ESM-only modules (`html-encoding-sniffer` → `@exodus/bytes`) that crash under
 * `require()` with `ERR_REQUIRE_ESM`, taking down every API route that imported
 * this module. `sanitize-html` is CommonJS-safe and synchronous, so it works on
 * both server and client without a DOM implementation.
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
 * Attribute allow-list, applied to every tag. `data-*` attributes carry all
 * editor node metadata (callout kind, smart-link refs, template variables,
 * tooltips, embeds …) and are permitted via the `data-*` wildcard.
 */
const ALLOWED_ATTR = [
  "href", "target", "rel", "title", "alt", "src", "srcset", "sizes", "poster",
  "width", "height", "loading", "decoding", "controls", "preload", "muted", "playsinline",
  "colspan", "rowspan", "scope", "headers", "align", "valign", "span",
  "id", "class", "style", "dir", "lang", "role", "aria-label", "aria-hidden", "aria-describedby",
  "allow", "allowfullscreen", "frameborder", "referrerpolicy", "type", "open", "start", "reversed",
  "data-*",
]

/**
 * Inline CSS properties that survive sanitization (color/format only). Values
 * are constrained to safe token shapes so `url(...)`, `expression(...)`, etc.
 * can never slip through.
 */
const COLOR = /^(#(0x)?[0-9a-f]{3,8}|rgba?\([\d.,\s%]+\)|hsla?\([\d.,\s%]+\)|[a-z]+)$/i
const LENGTH = /^(auto|[\d.]+(px|%|rem|em|vh|vw|ch)?)$/i
const ALLOWED_STYLES: sanitizeHtml.IOptions["allowedStyles"] = {
  "*": {
    color: [COLOR],
    "background-color": [COLOR],
    "text-align": [/^(left|right|center|justify|start|end)$/i],
    "font-weight": [/^(normal|bold|bolder|lighter|[1-9]00)$/i],
    "font-style": [/^(normal|italic|oblique)$/i],
    "text-decoration": [/^(none|underline|line-through|overline)(\s+(none|underline|line-through|overline))*$/i],
    width: [LENGTH],
    height: [LENGTH],
    "max-width": [LENGTH],
    "aspect-ratio": [/^[\d.]+(\s*\/\s*[\d.]+)?$/],
  },
}

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: { "*": ALLOWED_ATTR },
  // Only these URL schemes are allowed on href/src (plus relative + hash URLs).
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowProtocolRelative: false,
  allowedSchemesAppliedToAttributes: ["href", "src", "poster"],
  allowedIframeHostnames: ALLOWED_IFRAME_HOSTS,
  allowIframeRelativeUrls: false,
  allowedStyles: ALLOWED_STYLES,
  // Drop the *content* of dangerous tags entirely (not just the tag wrapper).
  nonTextTags: ["script", "style", "textarea", "option", "noscript"],
  // Remove <iframe> elements whose src was stripped because the host wasn't in
  // the allow-list, so we never leave behind an empty embed shell.
  exclusiveFilter: (frame) => frame.tag === "iframe" && !frame.attribs.src,
  transformTags: {
    a: (tagName, attribs) => {
      const next: Record<string, string> = { ...attribs }
      if (next.target === "_blank") {
        next.rel = "noopener noreferrer"
      }
      return { tagName, attribs: next }
    },
    iframe: (tagName, attribs) => {
      const next: Record<string, string> = { ...attribs }
      next.loading = "lazy"
      next.referrerpolicy = "strict-origin-when-cross-origin"
      return { tagName, attribs: next }
    },
  },
}

/**
 * Sanitize a rich-content HTML string. Safe to call on the server and client.
 * Always run this on save AND on paste, and again in the renderer.
 */
export function sanitizeRichHtml(html: string): string {
  if (!html) return ""
  return sanitizeHtml(html, OPTIONS)
}

/** Whether the allow-lists consider `html` already clean (no-op sanitize). */
export function isCleanRichHtml(html: string): boolean {
  return sanitizeRichHtml(html) === html
}
