"use client"

import { useEffect, useRef, useState } from "react"
import { Mark, mergeAttributes } from "@tiptap/core"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import Underline from "@tiptap/extension-underline"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Bold, Code2, Italic, Link2, Quote, Smile, Strikethrough, UnderlineIcon, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"

const Spoiler = Mark.create({
  name: "spoiler",
  parseHTML: () => [{ tag: "tg-spoiler" }, { tag: "span.tg-spoiler" }],
  renderHTML: ({ HTMLAttributes }) => ["tg-spoiler", mergeAttributes(HTMLAttributes), 0],
})

const EMOJIS = ["😀", "😂", "😍", "🔥", "🎉", "✅", "⭐", "❤️", "🎁", "🛍️", "🚀", "📣", "💎", "⚡", "👀", "🙏"]

function telegramHtml(html: string) {
  return html
    .replace(/<p>(.*?)<\/p>/gs, "$1\n")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<strong>/g, "<b>").replace(/<\/strong>/g, "</b>")
    .replace(/<em>/g, "<i>").replace(/<\/em>/g, "</i>")
    .replace(/<strike>/g, "<s>").replace(/<\/strike>/g, "</s>")
    .replace(/<blockquote><p>/g, "<blockquote>").replace(/<\/p><\/blockquote>/g, "</blockquote>")
    .replace(/<pre><code[^>]*>/g, "<pre>").replace(/<\/code><\/pre>/g, "</pre>")
    .trim()
}

type Props = { value: string; onChange: (value: string) => void }

export function TelegramMessageEditor({ value, onChange }: Props) {
  const [showEmoji, setShowEmoji] = useState(false)
  const lastEmittedValue = useRef(value)
  const editor = useEditor({
    immediatelyRender: false,
    content: value,
    extensions: [
      StarterKit.configure({ heading: false, bulletList: false, orderedList: false, horizontalRule: false }),
      Underline,
      Spoiler,
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer" } }),
      Placeholder.configure({ placeholder: "پیام خود را بنویسید؛ برای قالب‌بندی فقط متن را انتخاب کنید…" }),
    ],
    editorProps: { attributes: { class: "min-h-44 px-4 py-3 text-sm leading-7 outline-none", dir: "rtl" } },
    onUpdate: ({ editor: current }) => {
      const nextValue = telegramHtml(current.getHTML())
      lastEmittedValue.current = nextValue
      onChange(nextValue)
    },
  })

  useEffect(() => {
    if (!editor || value === lastEmittedValue.current) return
    lastEmittedValue.current = value
    editor.commands.setContent(value, { emitUpdate: false })
  }, [editor, value])

  if (!editor) return <div className="min-h-56 animate-pulse rounded-xl bg-secondary" />

  const link = () => {
    const previous = editor.getAttributes("link").href as string | undefined
    const href = window.prompt("آدرس لینک را وارد کنید", previous || "https://")
    if (href === null) return
    if (!href.trim()) editor.chain().focus().unsetLink().run()
    else editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run()
  }

  const tools = [
    { label: "ضخیم", icon: Bold, active: "bold", run: () => editor.chain().focus().toggleBold().run() },
    { label: "مورب", icon: Italic, active: "italic", run: () => editor.chain().focus().toggleItalic().run() },
    { label: "زیرخط", icon: UnderlineIcon, active: "underline", run: () => editor.chain().focus().toggleUnderline().run() },
    { label: "خط‌خورده", icon: Strikethrough, active: "strike", run: () => editor.chain().focus().toggleStrike().run() },
    { label: "اسپویلر", icon: EyeOff, active: "spoiler", run: () => editor.chain().focus().toggleMark("spoiler").run() },
    { label: "کد", icon: Code2, active: "code", run: () => editor.chain().focus().toggleCode().run() },
    { label: "نقل‌قول", icon: Quote, active: "blockquote", run: () => editor.chain().focus().toggleBlockquote().run() },
  ]

  return <div className="overflow-hidden rounded-xl border border-border bg-background focus-within:border-primary">
    <div className="flex flex-wrap items-center gap-1 border-b border-border bg-secondary/60 p-2" role="toolbar" aria-label="قالب‌بندی پیام تلگرام">
      {tools.map(({ label, icon: Icon, active, run }) => <button key={active} type="button" onClick={run} title={label} aria-label={label} aria-pressed={editor.isActive(active)} className={cn("flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground", editor.isActive(active) && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground")}><Icon className="size-4" /></button>)}
      <button type="button" onClick={link} title="لینک" aria-label="افزودن لینک" className={cn("flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground", editor.isActive("link") && "bg-primary text-primary-foreground")}><Link2 className="size-4" /></button>
      <div className="relative"><button type="button" onClick={() => setShowEmoji((open) => !open)} title="ایموجی" aria-label="افزودن ایموجی" className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground"><Smile className="size-4" /></button>{showEmoji ? <div className="absolute right-0 top-11 z-20 grid w-52 grid-cols-8 gap-1 rounded-xl border border-border bg-popover p-2 shadow-xl">{EMOJIS.map((emoji) => <button key={emoji} type="button" onClick={() => { editor.chain().focus().insertContent(emoji).run(); setShowEmoji(false) }} className="flex size-6 items-center justify-center rounded hover:bg-secondary" aria-label={`افزودن ${emoji}`}>{emoji}</button>)}</div> : null}</div>
    </div>
    <EditorContent editor={editor} />
    <div className="border-t border-border px-3 py-2 text-left text-xs text-muted-foreground"><span dir="ltr">{editor.getText().length.toLocaleString("fa-IR")} / 4096</span></div>
  </div>
}
