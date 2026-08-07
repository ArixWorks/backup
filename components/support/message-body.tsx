"use client"

import { useEffect, useRef, useState } from "react"
import { TypingDots } from "./typing-dots"

/**
 * Renders a message body. For a newly-arrived staff message (flagged via
 * `animate`), it first shows a typing indicator, then reveals the text with a
 * short live "streaming" effect — mimicking a real agent replying. User
 * messages and already-seen history render instantly.
 *
 * Staff rich replies carry sanitized `html` (produced server-side by
 * sanitizeRichHtml); everything else is plain text rendered with wrapping.
 */
export function MessageBody({
  body,
  html,
  animate,
}: {
  body: string
  html?: string | null
  animate?: boolean
}) {
  const [phase, setPhase] = useState<"typing" | "streaming" | "done">(animate ? "typing" : "done")
  const [shown, setShown] = useState(animate ? 0 : body.length)
  const startedRef = useRef(false)

  useEffect(() => {
    if (!animate || startedRef.current) return
    startedRef.current = true
    // Brief "typing…" pause, then reveal characters progressively.
    const typingTimer = setTimeout(() => {
      setPhase("streaming")
      const total = body.length
      const step = Math.max(1, Math.round(total / 40))
      let i = 0
      const interval = setInterval(() => {
        i += step
        if (i >= total) {
          setShown(total)
          setPhase("done")
          clearInterval(interval)
        } else {
          setShown(i)
        }
      }, 24)
    }, 650)
    return () => clearTimeout(typingTimer)
  }, [animate, body.length])

  if (phase === "typing") {
    return (
      <span className="text-muted-foreground">
        <TypingDots />
      </span>
    )
  }

  // Rich HTML only after the animation completes (avoids partial-tag rendering).
  if (html && phase === "done") {
    return (
      <div
        dir="auto"
        className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed [&_a]:text-primary [&_a]:underline"
        // Server-sanitized HTML from the admin editor (sanitizeRichHtml).
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  const text = phase === "done" ? body : body.slice(0, shown)
  return (
    <p dir="auto" className="whitespace-pre-wrap text-sm leading-relaxed text-pretty">
      {text}
      {phase === "streaming" && <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current align-middle" />}
    </p>
  )
}
