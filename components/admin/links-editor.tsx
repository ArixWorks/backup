"use client"

import { Plus, Trash2, Link2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export type ProductLink = { label: string; url: string }

/**
 * Editor for labeled product links (e.g. "Activation Link", "Warranty").
 * Rendered on the product card in the bot and the web app.
 */
export function LinksEditor({
  links,
  onChange,
}: {
  links: ProductLink[]
  onChange: (links: ProductLink[]) => void
}) {
  function update(index: number, patch: Partial<ProductLink>) {
    onChange(links.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }
  function add() {
    if (links.length >= 8) return
    onChange([...links, { label: "", url: "" }])
  }
  function remove(index: number) {
    onChange(links.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link2 className="h-3.5 w-3.5" />
          لینک‌های محصول
        </Label>
        <Button type="button" size="sm" variant="ghost" onClick={add} disabled={links.length >= 8}>
          <Plus className="h-4 w-4" />
          افزودن
        </Button>
      </div>
      {links.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          مثل «لینک فعال‌سازی» یا «گارانتی» که زیر کارت محصول نمایش داده می‌شوند.
        </p>
      ) : (
        <div className="space-y-2">
          {links.map((link, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={link.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="عنوان (مثلاً لینک فعال‌سازی)"
                className="flex-1"
              />
              <Input
                value={link.url}
                onChange={(e) => update(i, { url: e.target.value })}
                placeholder="https://…"
                dir="ltr"
                className="flex-1"
              />
              <Button type="button" size="icon" variant="ghost" onClick={() => remove(i)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
