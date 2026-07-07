"use client"

import { memo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import { cn } from "@/lib/utils"

/**
 * Sanitize schema that extends the safe default with the limited set of inline
 * formatting the AI copilot is allowed to emit: underline (<u>), highlight
 * (<mark>) and colored text (<span style="color:...">). `style` is only allowed
 * on inline elements; browsers ignore `javascript:` inside CSS so this is safe
 * for the trusted, admin-authored content we render here.
 */
const schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "u", "mark", "span"],
  attributes: {
    ...defaultSchema.attributes,
    span: [...(defaultSchema.attributes?.span ?? []), "style"],
    mark: [...(defaultSchema.attributes?.mark ?? []), "style"],
    u: [...(defaultSchema.attributes?.u ?? []), "style"],
  },
}

const remarkPlugins = [remarkGfm]
const rehypePlugins = [rehypeRaw, [rehypeSanitize, schema]] as const

/**
 * Renders markdown (plus a few safe inline HTML tags) with theme-aware,
 * RTL-friendly styling. Use everywhere a rich `description`/`body` is shown.
 */
export const RichText = memo(function RichText({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  if (!content?.trim()) return null
  return (
    <div
      dir="auto"
      className={cn(
        "space-y-3 text-sm leading-relaxed text-muted-foreground",
        "[&_strong]:font-bold [&_strong]:text-foreground",
        "[&_em]:italic",
        "[&_u]:underline [&_u]:underline-offset-2",
        "[&_del]:line-through [&_del]:opacity-70",
        "[&_mark]:rounded [&_mark]:bg-primary/20 [&_mark]:px-1 [&_mark]:py-0.5 [&_mark]:text-foreground",
        "[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
        "[&_h1]:mt-4 [&_h1]:text-lg [&_h1]:font-extrabold [&_h1]:text-foreground",
        "[&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-foreground",
        "[&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-foreground",
        "[&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:ps-5",
        "[&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:ps-5",
        "[&_li]:marker:text-primary",
        "[&_blockquote]:border-primary/50 [&_blockquote]:border-s-2 [&_blockquote]:ps-3 [&_blockquote]:text-foreground/80",
        "[&_hr]:my-4 [&_hr]:border-border",
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs",
        "[&_table]:w-full [&_table]:text-xs [&_th]:border [&_th]:border-border [&_th]:p-2 [&_td]:border [&_td]:border-border [&_td]:p-2",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rehypePlugins={rehypePlugins as any}
        components={{
          a: ({ node, ...props }) => <a target="_blank" rel="noopener noreferrer" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})
