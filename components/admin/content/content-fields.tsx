"use client"

import type { FieldDef } from "@/lib/cms/types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/**
 * Renders a content type's declared custom fields as form controls.
 * Values are stored in the `fields` JSON blob and validated server-side.
 */
export function ContentFields({
  fields,
  values,
  onChange,
}: {
  fields: FieldDef[]
  values: Record<string, unknown>
  onChange: (next: Record<string, unknown>) => void
}) {
  function set(key: string, value: unknown) {
    onChange({ ...values, [key]: value })
  }

  return (
    <div className="glass space-y-4 rounded-2xl border border-border/60 p-4">
      <h3 className="font-bold">فیلدهای اختصاصی</h3>
      {fields.map((f) => {
        const v = values[f.key]
        const id = `field-${f.key}`
        return (
          <div key={f.key} className="space-y-1.5">
            {f.type !== "boolean" && (
              <Label htmlFor={id}>
                {f.label}
                {f.required && <span className="text-destructive"> *</span>}
              </Label>
            )}
            {f.type === "textarea" ? (
              <Textarea
                id={id}
                value={(v as string) ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                rows={3}
                maxLength={f.maxLength}
              />
            ) : f.type === "boolean" ? (
              <div className="flex items-center justify-between">
                <Label htmlFor={id}>{f.label}</Label>
                <Switch
                  id={id}
                  checked={Boolean(v)}
                  onCheckedChange={(c) => set(f.key, c)}
                  aria-label={f.label}
                />
              </div>
            ) : f.type === "select" ? (
              <Select value={(v as string) ?? ""} onValueChange={(val) => set(f.key, val)}>
                <SelectTrigger id={id}>
                  <SelectValue placeholder={f.placeholder ?? "انتخاب کنید"} />
                </SelectTrigger>
                <SelectContent>
                  {f.options?.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={id}
                type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                value={(v as string | number) ?? ""}
                onChange={(e) =>
                  set(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)
                }
                placeholder={f.placeholder}
                min={f.min}
                max={f.max}
                maxLength={f.maxLength}
                dir={f.type === "url" ? "ltr" : undefined}
              />
            )}
            {f.help && <p className="text-[11px] text-muted-foreground">{f.help}</p>}
          </div>
        )
      })}
    </div>
  )
}
