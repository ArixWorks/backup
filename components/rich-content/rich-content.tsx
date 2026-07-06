import { cn } from "@/lib/utils"
import { prepareRichContent, type TocItem } from "@/lib/rich-content/render"
import type { VariableContext } from "@/lib/rich-content/variables"
import { richContentProse } from "./prose"

/**
 * RichContent — the canonical renderer for stored rich fields.
 *
 * - Backward compatible: renders BOTH legacy Markdown and new semantic HTML via
 *   the shared `prepareRichContent` pipeline, so no data migration is needed.
 * - SSR / SEO friendly: outputs plain semantic HTML on the server (no client JS
 *   required to read the content).
 * - Secure: sanitized with the same allow-list used on save + paste.
 * - Dynamic: resolves `{{variables}}` against an optional `variables` context.
 *
 * This is a Server Component. Use it everywhere a description/body/article is
 * displayed to end users.
 */
export function RichContent({
  content,
  variables,
  className,
  showToc = false,
}: {
  content: string | null | undefined
  variables?: VariableContext
  className?: string
  showToc?: boolean
}) {
  if (!content?.trim()) return null
  const { html, toc } = prepareRichContent(content, variables)
  if (!html) return null

  return (
    <div dir="auto" className={cn(richContentProse, className)}>
      {showToc && toc.length > 1 ? <TableOfContents items={toc} /> : null}
      {/* Content is sanitized server-side by prepareRichContent. */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}

/** Standalone Table of Contents built from heading anchors. */
export function TableOfContents({ items, className }: { items: TocItem[]; className?: string }) {
  if (items.length < 2) return null
  return (
    <nav
      aria-label="فهرست مطالب"
      className={cn(
        "mb-5 rounded-xl border border-border bg-muted/40 p-4 text-sm not-prose",
        className,
      )}
    >
      <p className="mb-2 font-bold text-foreground">فهرست مطالب</p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} style={{ paddingInlineStart: `${(item.level - 1) * 0.75}rem` }}>
            <a
              href={`#${item.id}`}
              className="text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
