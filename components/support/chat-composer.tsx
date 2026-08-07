"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { Loader2, Send, Paperclip, X, Smile, ImageIcon, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { uploadAttachment, type UploadedAttachment } from "@/lib/upload-client"

// A compact, dependency-free emoji set for inserting into the message text.
const EMOJIS = ["🙏","❤️","👍","👎","😊","🎉","🔥","😍","😮","😢","😂","🙌","✅","⭐","💯","👏","🤝","💬","📎","⚡"]

const MAX_FILES = 5
const MAX_BYTES = 6 * 1024 * 1024
// Accept only image, pdf and text — enforced again server-side by magic bytes.
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf,text/plain,.jpg,.jpeg,.png,.webp,.pdf,.txt"

/**
 * Shared message composer for the ticket thread (user side). Supports multiple
 * attachments with live previews, an emoji inserter, and Enter-to-send with
 * CJK IME safety. Files are uploaded on send; the verified descriptors are
 * handed back through `onSend`.
 */
export function ChatComposer({
  onSend,
  disabled,
  placeholder = "پیام خود را بنویسید…",
}: {
  onSend: (message: string, attachments: UploadedAttachment[]) => Promise<void>
  disabled?: boolean
  placeholder?: string
}) {
  const [text, setText] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  function addFiles(list: FileList | null) {
    if (!list) return
    const incoming = Array.from(list)
    const next: File[] = [...files]
    for (const f of incoming) {
      if (next.length >= MAX_FILES) {
        toast.error(`حداکثر ${MAX_FILES} فایل مجاز است`)
        break
      }
      if (f.size > MAX_BYTES) {
        toast.error(`«${f.name}» بیشتر از ۶ مگابایت است`)
        continue
      }
      next.push(f)
    }
    setFiles(next)
  }

  function insertEmoji(emoji: string) {
    const ta = taRef.current
    if (!ta) {
      setText((t) => t + emoji)
      return
    }
    const start = ta.selectionStart ?? text.length
    const end = ta.selectionEnd ?? text.length
    setText(text.slice(0, start) + emoji + text.slice(end))
    requestAnimationFrame(() => {
      ta.focus()
      const pos = start + emoji.length
      ta.setSelectionRange(pos, pos)
    })
  }

  async function submit() {
    if (busy || disabled) return
    if (text.trim().length < 1 && files.length === 0) return
    setBusy(true)
    try {
      const uploaded: UploadedAttachment[] = []
      for (const f of files) {
        uploaded.push(await uploadAttachment(f, "tickets", ["IMAGE", "PDF", "TEXT"]))
      }
      await onSend(text.trim(), uploaded)
      setText("")
      setFiles([])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در ارسال پیام")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => {
            const isImage = f.type.startsWith("image/")
            const url = isImage ? URL.createObjectURL(f) : null
            return (
              <div
                key={`${f.name}-${i}`}
                className="group relative flex items-center gap-2 rounded-xl border border-border bg-background/60 py-1.5 pl-2 pr-7"
              >
                {isImage && url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url || "/placeholder.svg"} alt={f.name} className="h-8 w-8 rounded-md object-cover" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    {f.type === "application/pdf" ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                  </span>
                )}
                <span dir="auto" className="max-w-28 truncate text-xs">{f.name}</span>
                <button
                  type="button"
                  onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground opacity-0 transition-opacity hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
                  aria-label="حذف فایل"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <Textarea
        ref={taRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Enter sends; Shift+Enter adds a newline. Never submit mid-IME
          // composition (CJK) or on Safari's unreliable 229 keyCode.
          if (
            e.key === "Enter" &&
            !e.shiftKey &&
            !e.nativeEvent.isComposing &&
            (e.nativeEvent as unknown as { keyCode?: number }).keyCode !== 229
          ) {
            e.preventDefault()
            void submit()
          }
        }}
        rows={2}
        aria-label={placeholder}
        placeholder={placeholder}
        className="resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
      />

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files)
          e.target.value = ""
        }}
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground"
            onClick={() => fileRef.current?.click()}
            aria-label="پیوست فایل"
          >
            <Paperclip className="h-4.5 w-4.5" />
          </Button>
          <Popover>
            <PopoverTrigger
              render={
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" aria-label="ایموجی">
                  <Smile className="h-4.5 w-4.5" />
                </Button>
              }
            />
            <PopoverContent className="w-64 p-2" side="top" align="start">
              <div className="grid grid-cols-7 gap-1">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => insertEmoji(e)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-lg transition-transform hover:scale-110 hover:bg-accent"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <Button onClick={submit} disabled={busy || disabled} size="sm" className="gap-1.5">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          ارسال
        </Button>
      </div>
    </div>
  )
}
