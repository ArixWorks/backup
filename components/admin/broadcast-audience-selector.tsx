"use client"

import { useDeferredValue, useState } from "react"
import useSWR from "swr"
import { Check, Search, UserRound, X } from "lucide-react"
import { fetcher } from "@/lib/api-client"
import { cn } from "@/lib/utils"

type UserOption = {
  id: string
  displayName: string
  alias?: string | null
  username?: string | null
  telegramUsername?: string | null
  telegramId?: string | null
  telegramChatId?: string | null
  vipManual: boolean
}

type Props = { selected: UserOption[]; onChange: (users: UserOption[]) => void }

export function BroadcastAudienceSelector({ selected, onChange }: Props) {
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim())
  const { data, isLoading } = useSWR<{ data: UserOption[] }>(`/api/v1/admin/users?q=${encodeURIComponent(deferredQuery)}`, fetcher)
  const selectedIds = new Set(selected.map((user) => user.id))
  const users = (data?.data ?? []).filter((user) => user.telegramChatId)

  function toggle(user: UserOption) {
    onChange(selectedIds.has(user.id) ? selected.filter((item) => item.id !== user.id) : [...selected, user].slice(0, 500))
  }

  return <div className="flex flex-col gap-3">
    <label className="relative flex items-center">
      <Search className="pointer-events-none absolute right-3 size-4 text-muted-foreground" />
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجو با نام، نام کاربری یا شناسه تلگرام" className="h-11 w-full rounded-xl border border-border bg-background pr-10 pl-3 text-sm outline-none focus:border-primary" />
    </label>
    {selected.length > 0 ? <div className="flex flex-wrap gap-2">{selected.map((user) => <button type="button" key={user.id} onClick={() => toggle(user)} className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"><span>{user.displayName}</span><X className="size-3" /></button>)}</div> : null}
    <div className="max-h-64 overflow-y-auto rounded-xl border border-border bg-background p-2">
      {isLoading ? <p className="p-4 text-center text-sm text-muted-foreground">در حال دریافت کاربران…</p> : users.length === 0 ? <p className="p-4 text-center text-sm text-muted-foreground">کاربر دارای تلگرام پیدا نشد.</p> : <div className="flex flex-col gap-1">{users.slice(0, 50).map((user) => {
        const active = selectedIds.has(user.id)
        const handle = user.telegramUsername || user.username || user.alias
        return <button type="button" key={user.id} onClick={() => toggle(user)} className={cn("flex items-center gap-3 rounded-lg p-3 text-right transition-colors", active ? "bg-primary/10" : "hover:bg-secondary")}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground"><UserRound className="size-4" /></span>
          <span className="min-w-0 flex-1"><b className="block truncate text-sm">{user.displayName}</b><small dir="ltr" className="block truncate text-right text-muted-foreground">{handle ? `@${handle.replace(/^@/, "")}` : user.telegramId || user.id}</small></span>
          <span className={cn("flex size-5 items-center justify-center rounded-md border", active ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{active ? <Check className="size-3" /> : null}</span>
        </button>
      })}</div>}
    </div>
    <p className="text-xs text-muted-foreground">{selected.length.toLocaleString("fa-IR")} کاربر انتخاب شده؛ فقط همین افراد پیام را دریافت می‌کنند.</p>
  </div>
}
