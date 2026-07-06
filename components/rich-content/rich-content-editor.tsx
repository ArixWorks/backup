"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { EditorContent, useEditor } from "@tiptap/react"
import { buildExtensions } from "./editor-extensions"
import { Toolbar } from "./toolbar"
import { EditorBubbleMenu } from "./bubble-menu"
import { SlashMenu } from "./slash-menu"
import { MediaManager } from "./media-manager"
import {
  LinkDialog,
  EmbedDialog,
  CalloutDialog,
  VariableDialog,
  AttachmentDialog,
  AiDialog,
  EmojiDialog,
} from "./insert-dialogs"
import { SeoPanel } from "./seo-panel"
import type { MediaAssetDTO } from "./client-api"
import type { DialogName } from "./slash-commands"
import { sanitizeRichHtml } from "@/lib/rich-content/sanitize"
import { toRenderableHtml } from "@/lib/rich-content/legacy"
import { richContentProse } from "./prose"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { BarChart3, Check, Loader2, Save } from "lucide-react"

export interface RichContentEditorProps {
  /** Current stored value — semantic HTML, or legacy markdown (auto-converted). */
  value: string
  /** Called (debounced) with sanitized semantic HTML whenever content changes. */
  onChange: (html: string) => void
  placeholder?: string
  /** Stable id used for local draft recovery (e.g. "product:123:description"). */
  draftKey?: string
  /** Optional SEO meta for the live assistant. */
  seo?: { title?: string; metaDescription?: string; keyword?: string }
  className?: string
  editable?: boolean
}

/**
 * The single shared Rich Content Editor used across every Level-3 content
 * surface. Loads HTML (or legacy markdown) into the ProseMirror document, emits
 * sanitized semantic HTML on change, and provides toolbar, slash menu, bubble
 * menu, media library, autosave/draft recovery, full-screen, and a live SEO
 * assistant.
 */
export function RichContentEditor({
  value,
  onChange,
  placeholder = "بنویسید یا «/» را برای دستورات فشار دهید…",
  draftKey,
  seo,
  className,
  editable = true,
}: RichContentEditorProps) {
  const [fullscreen, setFullscreen] = useState(false)
  const [showSeo, setShowSeo] = useState(false)
  const [dialog, setDialog] = useState<DialogName | null>(null)
  const [mediaTarget, setMediaTarget] = useState<"image" | "attachment" | null>(null)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle")
  const [liveHtml, setLiveHtml] = useState("")
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const initialHtml = useMemo(() => {
    const v = value ?? ""
    return toRenderableHtml(v)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const extensions = useMemo(() => buildExtensions(placeholder), [placeholder])

  const editor = useEditor({
    extensions,
    content: initialHtml,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "rc-prose focus:outline-none",
        dir: "rtl",
      },
    },
    onUpdate: ({ editor }) => {
      const html = sanitizeRichHtml(editor.getHTML())
      setLiveHtml(html)
      // Debounced onChange
      setSaveState("saving")
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        onChange(html)
        setSaveState("saved")
      }, 500)
      // Debounced local draft
      if (draftKey) {
        if (draftTimer.current) clearTimeout(draftTimer.current)
        draftTimer.current = setTimeout(() => {
          try {
            localStorage.setItem(`rc-draft:${draftKey}`, JSON.stringify({ html, at: Date.now() }))
          } catch {
            /* storage may be unavailable */
          }
        }, 1000)
      }
    },
  })

  // Initialize live html once editor exists.
  useEffect(() => {
    if (editor) setLiveHtml(sanitizeRichHtml(editor.getHTML()))
  }, [editor])

  // Local draft recovery on mount.
  useEffect(() => {
    if (!editor || !draftKey) return
    try {
      const raw = localStorage.getItem(`rc-draft:${draftKey}`)
      if (!raw) return
      const draft = JSON.parse(raw) as { html: string; at: number }
      const current = sanitizeRichHtml(editor.getHTML())
      if (draft.html && draft.html !== current) {
        const when = new Date(draft.at).toLocaleString("fa-IR")
        if (window.confirm(`یک پیش‌نویس ذخیره‌شده (${when}) یافت شد. بازیابی شود؟`)) {
          editor.commands.setContent(draft.html)
        }
      }
    } catch {
      /* ignore corrupt draft */
    }
  }, [editor, draftKey])

  // Sync external value changes (e.g. AI copilot filling the field).
  useEffect(() => {
    if (!editor) return
    const incoming = value ?? ""
    const normalized = toRenderableHtml(incoming)
    const current = sanitizeRichHtml(editor.getHTML())
    if (normalized && normalized !== current && normalized !== liveHtml) {
      editor.commands.setContent(normalized, { emitUpdate: false })
      setLiveHtml(sanitizeRichHtml(editor.getHTML()))
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  // Escape exits full-screen.
  useEffect(() => {
    if (!fullscreen) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFullscreen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [fullscreen])

  const openDialog = useCallback(
    (name: DialogName) => {
      if (name === "media") {
        setMediaTarget("image")
        return
      }
      if (name === "table") {
        editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        return
      }
      setDialog(name)
    },
    [editor],
  )

  const onMediaSelect = useCallback(
    (asset: MediaAssetDTO) => {
      if (!editor) return
      if (mediaTarget === "attachment" || asset.kind !== "IMAGE") {
        editor
          .chain()
          .focus()
          .insertContent({
            type: "attachment",
            attrs: { href: asset.url, filename: asset.filename, size: asset.size, mime: asset.mimeType },
          })
          .run()
      } else {
        editor
          .chain()
          .focus()
          .setImage({ src: asset.url, alt: asset.alt ?? "", title: asset.caption ?? "" } as never)
          .run()
      }
      setMediaTarget(null)
    },
    [editor, mediaTarget],
  )

  if (!editor) {
    return (
      <div className={cn("flex min-h-48 items-center justify-center rounded-lg border border-border", className)}>
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "rc-editor flex flex-col rounded-lg border border-border bg-background",
        fullscreen && "fixed inset-0 z-50 rounded-none",
        className,
      )}
    >
      <Toolbar
        editor={editor}
        fullscreen={fullscreen}
        onToggleFullscreen={() => setFullscreen((v) => !v)}
        onOpenMedia={() => {
          setMediaTarget("image")
        }}
        onOpenLink={() => setDialog("link")}
        onOpenEmoji={() => setDialog("emoji")}
        onOpenCallout={() => setDialog("callout")}
        onInsertTable={() =>
          editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
      />

      <div className={cn("flex min-h-0 flex-1", showSeo ? "divide-x divide-border" : "")}>
        <div className={cn("relative min-h-0 flex-1 overflow-y-auto", fullscreen ? "" : "max-h-[70vh]")}>
          <EditorContent
            editor={editor}
            className={cn(
              richContentProse,
              "px-4 py-4 [&_.ProseMirror]:min-h-40 [&_.ProseMirror]:outline-none",
            )}
          />
          <SlashMenu editor={editor} onOpenDialog={openDialog} />
          <EditorBubbleMenu editor={editor} onOpenLink={() => setDialog("link")} />
        </div>

        {showSeo ? (
          <aside className="hidden w-72 shrink-0 overflow-y-auto p-4 md:block">
            <SeoPanel
              html={liveHtml}
              title={seo?.title}
              metaDescription={seo?.metaDescription}
              keyword={seo?.keyword}
            />
          </aside>
        ) : null}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2"
            onClick={() => setShowSeo((v) => !v)}
          >
            <BarChart3 className="size-3.5" />
            دستیار سئو
          </Button>
        </div>
        <div className="flex items-center gap-1.5">
          {saveState === "saving" && (
            <>
              <Loader2 className="size-3.5 animate-spin" /> در حال ذخیره…
            </>
          )}
          {saveState === "saved" && (
            <>
              <Check className="size-3.5 text-[oklch(0.72_0.16_150)]" /> ذخیره شد
            </>
          )}
          {saveState === "idle" && (
            <>
              <Save className="size-3.5" /> آماده
            </>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <LinkDialog editor={editor} open={dialog === "link"} onOpenChange={(v) => !v && setDialog(null)} />
      <EmbedDialog editor={editor} open={dialog === "embed"} onOpenChange={(v) => !v && setDialog(null)} />
      <CalloutDialog editor={editor} open={dialog === "callout"} onOpenChange={(v) => !v && setDialog(null)} />
      <VariableDialog editor={editor} open={dialog === "variable"} onOpenChange={(v) => !v && setDialog(null)} />
      <AttachmentDialog
        editor={editor}
        open={dialog === "attachment"}
        onOpenChange={(v) => !v && setDialog(null)}
        onOpenMedia={() => {
          setDialog(null)
          setMediaTarget("attachment")
        }}
      />
      <AiDialog editor={editor} open={dialog === "ai"} onOpenChange={(v) => !v && setDialog(null)} />
      <EmojiDialog editor={editor} open={dialog === "emoji"} onOpenChange={(v) => !v && setDialog(null)} />

      <MediaManager
        open={mediaTarget !== null}
        onOpenChange={(v) => !v && setMediaTarget(null)}
        onSelect={onMediaSelect}
        accept={mediaTarget === "image" ? "IMAGE" : undefined}
      />
    </div>
  )
}
