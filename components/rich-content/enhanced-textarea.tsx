"use client"

import { useEffect, useRef, useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Smile } from "lucide-react"

const QUICK_EMOJIS = ["😀", "😍", "🎉", "🔥", "👍", "🙏", "❤️", "✅", "⭐", "💎", "🚀", "🎁", "⚠️", "📌", "💰", "🏆"]

export interface EnhancedTextareaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Show character counter; when maxLength is set, shows remaining. */
  showCount?: boolean
  maxLength?: number
  minRows?: number
  maxRows?: number
  className?: string
  id?: string
  "aria-label"?: string
}

/**
 * Level-2 "Enhanced" textarea: auto-resizing, optional character count, and a
 * lightweight emoji inserter. For semi-long text (short descriptions, replies)
 * that doesn't need the full Rich Content Editor. Emits plain text.
 */
export function EnhancedTextarea({
  value,
  onChange,
  placeholder,
  showCount = true,
  maxLength,
  minRows = 3,
  maxRows = 12,
  className,
  id,
  ...aria
}: EnhancedTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)

  // Auto-resize.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    const lineHeight = 24
    const min = minRows * lineHeight
    const max = maxRows * lineHeight
    el.style.height = `${Math.max(min, Math.min(max, el.scrollHeight))}px`
  }, [value, minRows, maxRows])

  const insertEmoji = (emoji: string) => {
    const el = ref.current
    if (!el) {
      onChange(value + emoji)
      setEmojiOpen(false)
      return
    }
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? value.length
    const next = value.slice(0, start) + emoji + value.slice(end)
    onChange(next)
    setEmojiOpen(false)
    requestAnimationFrame(() => {
      el.focus()
      el.selectionStart = el.selectionEnd = start + emoji.length
    })
  }

  return (
    <div className={cn("relative", className)}>
      <Textarea
        ref={ref}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={minRows}
        className="resize-none pe-10"
        {...aria}
      />
      <div className="absolute inset-inline-end-2 top-2">
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger
            render={
              <Button type="button" variant="ghost" size="icon" className="size-7" aria-label="درج اموجی">
                <Smile className="size-4 text-muted-foreground" />
              </Button>
            }
          />
          <PopoverContent className="w-56 p-2" align="end">
            <div className="grid grid-cols-8 gap-1">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
                  className="flex size-6 items-center justify-center rounded text-base hover:bg-accent"
                  aria-label={`درج ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {showCount ? (
        <div className="mt-1 text-end text-xs text-muted-foreground">
          {maxLength ? `${value.length} / ${maxLength}` : `${value.length} نویسه`}
        </div>
      ) : null}
    </div>
  )
}
