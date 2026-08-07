"use client"

import { useState } from "react"
import { SmilePlus } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type ReactionType = "THANKS" | "HEART" | "LIKE" | "DISLIKE"
export type Reaction = { id: string; type: ReactionType; userId: string }

export const REACTION_EMOJI: Record<ReactionType, string> = {
  THANKS: "🙏",
  HEART: "❤️",
  LIKE: "👍",
  DISLIKE: "👎",
}

const ORDER: ReactionType[] = ["THANKS", "HEART", "LIKE", "DISLIKE"]

/**
 * Emoji reactions attached directly to a message (Telegram/WhatsApp style).
 * Shows aggregate chips with counts and a picker to add/toggle a reaction.
 * `myUserId` highlights the current user's own reaction; clicking the same
 * emoji removes it.
 */
export function MessageReactions({
  reactions,
  myUserId,
  onReact,
  align = "start",
}: {
  reactions: Reaction[]
  myUserId: string
  onReact: (type: ReactionType) => void
  align?: "start" | "end"
}) {
  const [open, setOpen] = useState(false)

  // Aggregate counts per type and detect which one is mine.
  const counts = new Map<ReactionType, number>()
  let mine: ReactionType | null = null
  for (const r of reactions) {
    counts.set(r.type, (counts.get(r.type) ?? 0) + 1)
    if (r.userId === myUserId) mine = r.type
  }

  return (
    <div className={cn("mt-1 flex flex-wrap items-center gap-1", align === "end" && "justify-end")}>
      {ORDER.filter((t) => counts.has(t)).map((t) => {
        const isMine = mine === t
        return (
          <button
            key={t}
            type="button"
            onClick={() => onReact(t)}
            className={cn(
              "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
              isMine
                ? "border-primary/40 bg-primary/15 text-foreground"
                : "border-border bg-background/60 text-muted-foreground hover:bg-accent",
            )}
            aria-pressed={isMine}
          >
            <span className="text-sm leading-none">{REACTION_EMOJI[t]}</span>
            <span className="tabular-nums">{counts.get(t)}</span>
          </button>
        )
      })}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background/60 text-muted-foreground transition-colors hover:bg-accent"
              aria-label="افزودن واکنش"
            >
              <SmilePlus className="h-3.5 w-3.5" />
            </button>
          }
        />
        <PopoverContent className="flex w-auto gap-1 p-1.5" align={align} side="top">
          {ORDER.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                onReact(t)
                setOpen(false)
              }}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-transform hover:scale-110 hover:bg-accent",
                mine === t && "bg-primary/15",
              )}
              aria-label={t}
            >
              {REACTION_EMOJI[t]}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  )
}
