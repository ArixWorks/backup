"use client"

import { useState, useRef, useEffect } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Send, Square, Sparkles, Loader2, Database } from "lucide-react"
import { Button } from "@/components/ui/button"

const SUGGESTIONS = [
  "وضعیت کلی فروشگاه چطوره؟",
  "چند تیکت باز داریم؟",
  "آخرین سفارش‌ها رو نشون بده",
  "محصولات غیرفعال رو پیدا کن",
]

const TOOL_LABELS: Record<string, string> = {
  getDashboardStats: "دریافت آمار فروشگاه",
  searchProducts: "جستجوی محصولات",
  findUser: "جستجوی کاربر",
  listRecentOrders: "بررسی سفارش‌ها",
}

export function CopilotChat() {
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const { messages, sendMessage, status, stop, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/v1/admin/ai/copilot" }),
  })

  const busy = status === "submitted" || status === "streaming"

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, status])

  function submit(text: string) {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    void sendMessage({ text: trimmed })
    setInput("")
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="size-6" />
            </div>
            <p className="max-w-sm text-pretty text-sm text-muted-foreground">
              سوالت رو بپرس یا یکی از پیشنهادها رو انتخاب کن.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={m.role === "user" ? "flex justify-start" : "flex justify-end"}
          >
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground"
                  : "max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm text-foreground"
              }
            >
              {m.parts.map((part, i) => {
                if (part.type === "text") {
                  return (
                    <p key={i} className="whitespace-pre-wrap leading-relaxed">
                      {part.text}
                    </p>
                  )
                }
                if (part.type.startsWith("tool-")) {
                  const name = part.type.replace("tool-", "")
                  return (
                    <div
                      key={i}
                      className="my-1 flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      <Database className="size-3" />
                      <span>{TOOL_LABELS[name] ?? name}</span>
                    </div>
                  )
                }
                return null
              })}
            </div>
          </div>
        ))}

        {status === "submitted" && (
          <div className="flex justify-end">
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span>در حال فکر کردن…</span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              خطا در دریافت پاسخ. دوباره تلاش کن.
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit(input)
        }}
        className="flex items-end gap-2 border-t border-border bg-background p-3"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing &&
              e.keyCode !== 229
            ) {
              e.preventDefault()
              submit(input)
            }
          }}
          placeholder="سوالت رو بنویس…"
          rows={1}
          className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
        />
        {busy ? (
          <Button type="button" size="icon" variant="secondary" onClick={() => stop()}>
            <Square className="size-4" />
            <span className="sr-only">توقف</span>
          </Button>
        ) : (
          <Button type="submit" size="icon" disabled={!input.trim()}>
            <Send className="size-4" />
            <span className="sr-only">ارسال</span>
          </Button>
        )}
      </form>
    </div>
  )
}
