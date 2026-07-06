import { marked } from "marked"

/**
 * Backward-compatibility layer.
 *
 * Historically rich fields stored Markdown (rendered by the old `RichText`
 * component). The new editor stores semantic HTML. During (and after) the
 * migration the database contains BOTH formats, so the renderer must accept
 * either. This module detects the format and normalizes legacy Markdown to
 * HTML so a single render path works for all content — no data migration is
 * required for old rows to keep displaying correctly.
 */

marked.setOptions({ gfm: true, breaks: true })

/** Heuristic: does this string already contain block-level HTML we emit? */
export function looksLikeHtml(content: string): boolean {
  const s = content.trimStart()
  if (!s.startsWith("<")) return false
  return /<(?:p|div|h[1-6]|ul|ol|li|table|blockquote|figure|section|pre|img|hr|br|span|aside|details)\b/i.test(s)
}

/**
 * Normalize any stored rich value to an HTML string ready for sanitize +
 * render. HTML passes through untouched; Markdown is converted with GFM.
 */
export function toRenderableHtml(content: string): string {
  if (!content?.trim()) return ""
  if (looksLikeHtml(content)) return content
  return marked.parse(content, { async: false }) as string
}
