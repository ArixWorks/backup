"use client"

import { useState } from "react"
import { BubbleMenu } from "@tiptap/react/menus"
import type { Editor } from "@tiptap/react"
import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, Link2, Sparkles, Loader2, Wand2, Minimize2, Maximize2, Languages, SpellCheck, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { runInline } from "./client-api"
import type { InlineAction } from "./types"

const AI_ACTIONS: { action: InlineAction; label: string; icon: typeof Wand2 }[] = [
  { action: "improve", label: "بهبود متن", icon: Wand2 },
  { action: "rewrite", label: "بازنویسی", icon: Sparkles },
  { action: "shorten", label: "کوتاه‌تر", icon: Minimize2 },
  { action: "expand", label: "گسترش", icon: Maximize2 },
  { action: "grammar", label: "اصلاح دستوری", icon: SpellCheck },
  { action: "seo", label: "بهینه‌سازی سئو", icon: Search },
  { action: "translate", label: "ترجمه به انگلیسی", icon: Languages },
]

export function EditorBubbleMenu({
  editor,
  disableAi,
  onOpenLink,
}: {
  editor: Editor
  disableAi?: boolean
  onOpenLink: () => void
}) {
  const [aiOpen, setAiOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const runAi = async (action: InlineAction) => {
    const { from, to } = editor.state.selection
    if (from === to) return
    const selectedHtml = getSelectionHtml(editor)
    if (!selectedHtml) return
    setBusy(true)
    try {
      const html = await runInline(action, selectedHtml, action === "translate" ? "en" : undefined)
      editor.chain().focus().deleteSelection().insertContent(html).run()
      setAiOpen(false)
    } catch (err) {
      console.log("[v0] inline ai failed:", err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top", offset: 8 }}
      shouldShow={({ editor: e, from, to }) => from !== to && !e.isActive("codeBlock")}
    >
      <div className="flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-lg">
        {aiOpen ? (
          <div className="flex max-w-[80vw] flex-wrap items-center gap-0.5">
            {busy ? (
              <span className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> در حال پردازش…
              </span>
            ) : (
              AI_ACTIONS.map(({ action, label, icon: Icon }) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => runAi(action)}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  <Icon className="size-3.5" />
                  {label}
                </button>
              ))
            )}
          </div>
        ) : (
          <>
            <Btn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} label="پررنگ">
              <Bold className="size-4" />
            </Btn>
            <Btn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} label="مورب">
              <Italic className="size-4" />
            </Btn>
            <Btn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} label="زیرخط">
              <UnderlineIcon className="size-4" />
            </Btn>
            <Btn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} label="خط‌خورده">
              <Strikethrough className="size-4" />
            </Btn>
            <Btn active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} label="کد">
              <Code className="size-4" />
            </Btn>
            <Btn active={editor.isActive("link")} onClick={onOpenLink} label="پیوند">
              <Link2 className="size-4" />
            </Btn>
            {!disableAi && (
              <button
                type="button"
                onClick={() => setAiOpen(true)}
                className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
              >
                <Sparkles className="size-3.5" />
                هوش مصنوعی
              </button>
            )}
          </>
        )}
      </div>
    </BubbleMenu>
  )
}

function Btn({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn("flex size-8 items-center justify-center rounded-md hover:bg-accent", active && "bg-primary/15 text-primary")}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  )
}

/** Serialize the current selection to HTML for AI processing. */
function getSelectionHtml(editor: Editor): string {
  const { from, to } = editor.state.selection
  const slice = editor.state.doc.slice(from, to)
  const div = document.createElement("div")
  const fragment = editor.view.someProp("clipboardSerializer")?.serializeFragment(slice.content)
  if (fragment) {
    div.appendChild(fragment)
    return div.innerHTML
  }
  return editor.state.doc.textBetween(from, to, "\n")
}
