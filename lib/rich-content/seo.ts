/**
 * SEO Assistant analysis. Pure, isomorphic string analysis of the editor's
 * current HTML — used by the live in-editor panel. Advisory only; never blocks
 * saving. No DOM required so it can also run server-side if needed.
 */

export interface HeadingNode {
  level: number
  text: string
}

export interface SeoIssue {
  id: string
  severity: "good" | "warn" | "error"
  message: string
}

export interface SeoReport {
  wordCount: number
  readingTimeMin: number
  headings: HeadingNode[]
  missingAlt: number
  imageCount: number
  linkCount: number
  externalLinkCount: number
  issues: SeoIssue[]
}

function stripTags(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function extractHeadings(html: string): HeadingNode[] {
  const out: HeadingNode[] = []
  const re = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    out.push({ level: Number(m[1]), text: stripTags(m[2]) })
  }
  return out
}

/** Word count that works for both spaced (Latin) and Persian/Arabic text. */
export function countWords(text: string): number {
  const t = text.trim()
  if (!t) return 0
  return t.split(/\s+/).filter(Boolean).length
}

export function analyzeSeo(
  html: string,
  meta?: { title?: string; metaDescription?: string; keyword?: string },
): SeoReport {
  const text = stripTags(html)
  const wordCount = countWords(text)
  const readingTimeMin = Math.max(1, Math.round(wordCount / 200))
  const headings = extractHeadings(html)

  const imgTags = html.match(/<img\b[^>]*>/gi) ?? []
  const imageCount = imgTags.length
  const missingAlt = imgTags.filter((t) => !/\balt\s*=\s*["'][^"']+["']/i.test(t)).length

  const anchorTags = html.match(/<a\b[^>]*>/gi) ?? []
  const linkCount = anchorTags.length
  const externalLinkCount = anchorTags.filter((t) => /href\s*=\s*["']https?:/i.test(t)).length

  const issues: SeoIssue[] = []

  // Heading structure
  const h1s = headings.filter((h) => h.level === 1)
  if (h1s.length === 0) issues.push({ id: "h1", severity: "warn", message: "هیچ عنوان H1 وجود ندارد" })
  else if (h1s.length > 1) issues.push({ id: "h1", severity: "warn", message: `${h1s.length} عنوان H1 دارید؛ فقط یکی توصیه می‌شود` })
  else issues.push({ id: "h1", severity: "good", message: "ساختار H1 مناسب است" })

  // Skipped heading levels
  let skipped = false
  for (let i = 1; i < headings.length; i++) {
    if (headings[i].level - headings[i - 1].level > 1) skipped = true
  }
  if (skipped) issues.push({ id: "hier", severity: "warn", message: "سلسله‌مراتب عناوین پرش دارد (مثلاً H2 → H4)" })

  // Length
  if (wordCount < 50) issues.push({ id: "len", severity: "warn", message: "محتوا کوتاه است (کمتر از ۵۰ کلمه)" })
  else issues.push({ id: "len", severity: "good", message: `${wordCount} کلمه` })

  // Missing alt
  if (missingAlt > 0) issues.push({ id: "alt", severity: "error", message: `${missingAlt} تصویر بدون متن جایگزین (alt)` })
  else if (imageCount > 0) issues.push({ id: "alt", severity: "good", message: "همه تصاویر alt دارند" })

  // Meta title
  if (meta?.title !== undefined) {
    const len = meta.title.trim().length
    if (len === 0) issues.push({ id: "title", severity: "warn", message: "عنوان سئو خالی است" })
    else if (len > 60) issues.push({ id: "title", severity: "warn", message: `عنوان سئو طولانی است (${len}/۶۰)` })
    else issues.push({ id: "title", severity: "good", message: `طول عنوان سئو مناسب است (${len}/۶۰)` })
  }

  // Meta description
  if (meta?.metaDescription !== undefined) {
    const len = meta.metaDescription.trim().length
    if (len === 0) issues.push({ id: "desc", severity: "warn", message: "توضیح متا خالی است" })
    else if (len < 120 || len > 160)
      issues.push({ id: "desc", severity: "warn", message: `طول توضیح متا خارج از بازه است (${len}؛ ۱۲۰–۱۶۰)` })
    else issues.push({ id: "desc", severity: "good", message: `طول توضیح متا مناسب است (${len})` })
  }

  // Keyword density
  if (meta?.keyword && meta.keyword.trim()) {
    const kw = meta.keyword.trim().toLowerCase()
    const hits = text.toLowerCase().split(kw).length - 1
    const density = wordCount ? (hits / wordCount) * 100 : 0
    if (hits === 0) issues.push({ id: "kw", severity: "warn", message: "کلمه کلیدی در متن یافت نشد" })
    else issues.push({ id: "kw", severity: "good", message: `تراکم کلمه کلیدی: ${density.toFixed(1)}٪ (${hits} بار)` })
  }

  return {
    wordCount,
    readingTimeMin,
    headings,
    missingAlt,
    imageCount,
    linkCount,
    externalLinkCount,
    issues,
  }
}
