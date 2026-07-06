"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Editor } from "@tiptap/react"
import { SLASH_COMMANDS, GROUP_LABEL, type DialogName, type SlashCommand } from "./slash-commands"
import { cn } from "@/lib/utils"

/**
 * Notion-style slash command menu. Listens for a "/" typed at the start of an
 * empty text position, shows a filtered, keyboard-navigable list anchored to
 * the caret, and runs the chosen command (deleting the "/query" text first).
 */
export function SlashMenu({
  editor,
  onOpenDialog,
}: {
  editor: Editor
  onOpenDialog: (name: DialogName) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [active, setActive] = useState(0)
  const rangeRef = useRef<{ from: number; to: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = SLASH_COMMANDS.filter((cmd) => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      cmd.title.toLowerCase().includes(q) ||
      cmd.keywords.some((k) => k.toLowerCase().includes(q))
    )
  })

  const close = useCallback(() => {
    setOpen(false)
    setQuery("")
    setActive(0)
    rangeRef.current = null
  }, [])

  const runCommand = useCallback(
    (cmd: SlashCommand) => {
      const range = rangeRef.current
      if (range) {
        editor.chain().focus().deleteRange(range).run()
      }
      cmd.run(editor, onOpenDialog)
      close()
    },
    [editor, onOpenDialog, close],
  )

  // Detect "/" trigger from document changes.
  useEffect(() => {
    if (!editor) return
    const update = () => {
      const { state } = editor
      const { $from, empty } = state.selection
      if (!empty) {
        if (open) close()
        return
      }
      const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, "\uFFFC")
      const match = /(?:^|\s)\/([\p{L}\p{N}]*)$/u.exec(textBefore)
      if (match) {
        const q = match[1]
        const slashLen = q.length + 1
        rangeRef.current = { from: $from.pos - slashLen, to: $from.pos }
        setQuery(q)
        setActive(0)
        try {
          const coords = editor.view.coordsAtPos($from.pos)
          const box = editor.view.dom.getBoundingClientRect()
          const MENU_WIDTH = 256 // matches w-64
          // Clamp so the fixed-width menu never overflows the editor edges.
          const rawLeft = coords.left - box.left
          const maxLeft = Math.max(0, box.width - MENU_WIDTH - 8)
          setPos({ top: coords.bottom - box.top + 4, left: Math.min(Math.max(rawLeft, 0), maxLeft) })
        } catch {
          /* ignore */
        }
        setOpen(true)
      } else if (open) {
        close()
      }
    }
    editor.on("selectionUpdate", update)
    editor.on("update", update)
    return () => {
      editor.off("selectionUpdate", update)
      editor.off("update", update)
    }
  }, [editor, open, close])

  // Keyboard navigation.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActive((a) => (a + 1) % Math.max(filtered.length, 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setActive((a) => (a - 1 + filtered.length) % Math.max(filtered.length, 1))
      } else if (e.key === "Enter") {
        if (filtered[active]) {
          e.preventDefault()
          runCommand(filtered[active])
        }
      } else if (e.key === "Escape") {
        e.preventDefault()
        close()
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [open, filtered, active, runCommand, close])

  if (!open || !pos || filtered.length === 0) return null

  // Group commands for display.
  const groups = filtered.reduce<Record<string, SlashCommand[]>>((acc, cmd) => {
    ;(acc[cmd.group] ??= []).push(cmd)
    return acc
  }, {})
  let flatIndex = -1

  return (
    <div
      ref={containerRef}
      className="absolute z-50 max-h-72 w-64 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg"
      style={{ top: pos.top, left: pos.left }}
      role="listbox"
    >
      {Object.entries(groups).map(([group, cmds]) => (
        <div key={group} className="mb-1 last:mb-0">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">
            {GROUP_LABEL[group as SlashCommand["group"]]}
          </div>
          {cmds.map((cmd) => {
            flatIndex++
            const idx = flatIndex
            const Icon = cmd.icon
            return (
              <button
                key={cmd.key}
                type="button"
                role="option"
                aria-selected={idx === active}
                onMouseEnter={() => setActive(idx)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  runCommand(cmd)
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-start text-sm transition-colors",
                  idx === active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                )}
              >
                <span className="flex size-7 flex-none items-center justify-center rounded-md border border-border bg-card">
                  <Icon className="size-3.5" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{cmd.title}</span>
                  <span className="truncate text-xs text-muted-foreground">{cmd.description}</span>
                </span>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
