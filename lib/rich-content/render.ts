import { toRenderableHtml } from "./legacy"
import { sanitizeRichHtml } from "./sanitize"
import { resolveVariablesInHtml, type VariableContext } from "./variables"

/**
 * Server-safe pipeline that turns any stored rich value (legacy Markdown OR new
 * semantic HTML) into final, sanitized, variable-resolved HTML with stable
 * heading anchor ids. Pure string transforms — no DOM — so it runs in RSC.
 */

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
