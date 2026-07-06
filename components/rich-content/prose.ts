/**
 * Shared prose styling for rich content. Used by BOTH the server renderer
 * (`RichContent`) and the editor's editable surface so what you author matches
 * what readers see (WYSIWYG). Kept as a plain string (no "use client") so it is
 * importable from server and client components alike.
 *
 * All colors use design tokens — never hard-coded values — to stay theme-aware.
 */
export const richContentProse = [
  "rc-prose text-sm leading-relaxed text-foreground/90",
  "[&>*+*]:mt-3",
  // headings
  "[&_h1]:mt-6 [&_h1]:scroll-mt-24 [&_h1]:text-2xl [&_h1]:font-extrabold [&_h1]:text-foreground",
  "[&_h2]:mt-5 [&_h2]:scroll-mt-24 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground",
  "[&_h3]:mt-4 [&_h3]:scroll-mt-24 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-foreground",
  "[&_h4]:mt-3 [&_h4]:scroll-mt-24 [&_h4]:text-base [&_h4]:font-bold [&_h4]:text-foreground",
  // inline
  "[&_strong]:font-bold [&_strong]:text-foreground",
  "[&_em]:italic",
  "[&_u]:underline [&_u]:underline-offset-2",
  "[&_s]:line-through [&_s]:opacity-70",
  "[&_mark]:rounded [&_mark]:bg-primary/20 [&_mark]:px-1 [&_mark]:py-0.5 [&_mark]:text-foreground",
  "[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
  "[&_kbd]:rounded [&_kbd]:border [&_kbd]:border-border [&_kbd]:bg-muted [&_kbd]:px-1.5 [&_kbd]:py-0.5 [&_kbd]:font-mono [&_kbd]:text-xs",
  // lists
  "[&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pe-5",
  "[&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pe-5",
  "[&_li]:marker:text-primary",
  // quotes
  "[&_blockquote]:border-primary/50 [&_blockquote]:border-e-4 [&_blockquote]:pe-4 [&_blockquote]:text-foreground/80 [&_blockquote]:italic",
  "[&_hr]:my-6 [&_hr]:border-border",
  // figures / images
  "[&_figure]:my-4 [&_figure]:space-y-2",
  "[&_img]:rounded-xl [&_img]:border [&_img]:border-border [&_img]:max-w-full [&_img]:h-auto",
  "[&_figcaption]:text-center [&_figcaption]:text-xs [&_figcaption]:text-muted-foreground",
  // code
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs",
  "[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-border [&_pre]:bg-muted/60 [&_pre]:p-4",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[13px] [&_pre_code]:leading-relaxed",
  // tables
  "[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs",
  "[&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:p-2 [&_th]:font-bold",
  "[&_td]:border [&_td]:border-border [&_td]:p-2",
  // embeds
  "[&_iframe]:my-4 [&_iframe]:aspect-video [&_iframe]:w-full [&_iframe]:rounded-xl [&_iframe]:border [&_iframe]:border-border",
  "[&_video]:my-4 [&_video]:w-full [&_video]:rounded-xl [&_video]:border [&_video]:border-border",
].join(" ")
