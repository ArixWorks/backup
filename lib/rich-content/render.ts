import { toRenderableHtml } from "./legacy"
import { sanitizeRichHtml } from "./sanitize"
import { resolveVariablesInHtml, type VariableContext } from "./variables"

/**
 * Server-safe pipeline that turns any stored rich value (legacy Markdown OR new
 * semantic HTML) into final, sanitized, variable-resolved HTML with stable
 * heading anchor ids. Pure string transforms — no DOM — so it runs in RSC.
 */

/**
 * Convert any stored rich value (legacy Markdown OR semantic HTML) into a clean
 * single-line plain-text snippet, suitable for card excerpts, list previews and
 * meta descriptions. Strips HTML tags and common Markdown markers so raw markup
 * like `<p>` or `###` never leaks into the UI. Pure string transform (RSC-safe).
 */
export function richExcerpt(content: string | null | undefined, maxLength = 160): string {
  if (!content?.trim()) return ""
  let text = content
    // Drop fenced/inline code fences but keep their text
    .replace(/```[a-z]*\n?/gi, " ")
    .replace(/`([^`]*)`/g, "$1")
    // HTML tags -> space
    .replace(/<[^>]+>/g, " ")
    // Decode the few entities our sanitizer emits
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Markdown links/images -> label only
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Leading block markers: headings, quotes, list bullets
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    // Emphasis / strikethrough markers
    .replace(/(\*\*|__|\*|_|~~)/g, "")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim()
  if (text.length > maxLength) {
    text = text.slice(0, maxLength).replace(/\s+\S*$/, "").trim() + "…"
  }
  return text
}

/** URL-safe slug that keeps Persian/Arabic letters (for anchor links). */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
}

export interface TocItem {
  id: string
  level: number
  text: string
}

/**
 * Inject deterministic `id` attributes onto every heading (for anchor links)
 * and return the table of contents. Existing ids are preserved.
 */
export function injectHeadingIds(html: string): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = []
  const used = new Set<string>()
  const out = html.replace(
    /<h([1-6])((?:\s+[^>]*)?)>([\s\S]*?)<\/h\1>/gi,
    (_m, level: string, attrs: string, inner: string) => {
      const text = inner.replace(/<[^>]+>/g, "").trim()
      const existing = /\bid\s*=\s*["']([^"']+)["']/.exec(attrs)?.[1]
      let id = existing ?? slugify(text) ?? `section-${toc.length + 1}`
      if (!id) id = `section-${toc.length + 1}`
      let unique = id
      let n = 2
      while (used.has(unique)) unique = `${id}-${n++}`
      used.add(unique)
      toc.push({ id: unique, level: Number(level), text })
      const attrsNoId = attrs.replace(/\s+id\s*=\s*["'][^"']*["']/i, "")
      return `<h${level}${attrsNoId} id="${unique}">${inner}</h${level}>`
    },
  )
  return { html: out, toc }
}

export interface PreparedContent {
  html: string
  toc: TocItem[]
}

/**
 * Full render pipeline: normalize legacy → resolve variables → sanitize →
 * inject anchor ids. Returns final HTML + table of contents.
 */
export function prepareRichContent(content: string, variables?: VariableContext): PreparedContent {
  if (!content?.trim()) return { html: "", toc: [] }
  let html = toRenderableHtml(content)
  if (variables) html = resolveVariablesInHtml(html, variables)
  html = sanitizeRichHtml(html)
  return injectHeadingIds(html)
}
