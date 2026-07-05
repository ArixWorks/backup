"use client"

import type { ReactNode } from "react"

/** Small "از .env" / "پنل" origin badge so admins see where a value comes from. */
export function SourceBadge({ source }: { source?: "db" | "env" }) {
  if (!source) return null
  const isDb = source === "db"
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
        isDb
          ? "bg-primary/10 text-primary"
          : "bg-secondary text-muted-foreground"
      }`}
    >
      {isDb ? "پنل" : "از .env"}
    </span>
  )
}

export function Field({
  label,
  hint,
  source,
  children,
}: {
  label: string
  hint?: string
  source?: "db" | "env"
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center gap-2 text-sm font-bold">
        {label}
        <SourceBadge source={source} />
      </span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      {children}
    </label>
  )
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <div>
        <div className="font-bold">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked ? "true" : "false")}
        className="h-5 w-5 accent-primary"
      />
    </label>
  )
}
