"use client"

import { useState } from "react"
import { Eye, EyeOff, Lock, Send, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"
import { orderCopy } from "@/lib/i18n/order-copy"
import { fieldLabel, type DeliveryTemplate, type DeliveryFieldDef } from "@/lib/core/delivery-fields"

/**
 * Buyer-facing form to submit the account info an order needs (e.g. email +
 * password of their own account). Sensitive fields render as masked inputs
 * with a reveal toggle and a reassuring "stored securely" note. Fields are
 * driven by the admin-authored template snapshotted onto the order.
 */
export function CustomerInputForm({
  template,
  onSubmit,
  submitting,
}: {
  template: DeliveryTemplate
  onSubmit: (values: Record<string, string>) => void
  submitting: boolean
}) {
  const { locale } = useI18n()
  const c = orderCopy(locale)
  const [values, setValues] = useState<Record<string, string>>({})
  const [reveal, setReveal] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, boolean>>({})

  function set(key: string, v: string) {
    setValues((p) => ({ ...p, [key]: v }))
    if (errors[key]) setErrors((p) => ({ ...p, [key]: false }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const next: Record<string, boolean> = {}
    for (const f of template) {
      if (f.required !== false && !values[f.key]?.trim()) next[f.key] = true
    }
    setErrors(next)
    if (Object.keys(next).length > 0) return
    onSubmit(values)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <p className="text-xs leading-relaxed text-muted-foreground">{c.inputDesc}</p>
      </div>

      {template.map((f: DeliveryFieldDef) => {
        const sensitive = f.type === "password" || f.type === "totp" || f.sensitive
        const isNote = f.type === "note"
        const showReveal = reveal[f.key]
        const invalid = errors[f.key]
        const label = fieldLabel(f, locale)
        return (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={`ci-${f.key}`} className="flex items-center gap-1.5">
              {sensitive && <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
              {label}
              {f.required !== false && <span className="text-destructive">*</span>}
            </Label>
            {isNote ? (
              <Textarea
                id={`ci-${f.key}`}
                dir="auto"
                value={values[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                className={cn(invalid && "border-destructive")}
              />
            ) : (
              <div className="relative">
                <Input
                  id={`ci-${f.key}`}
                  dir={sensitive ? "ltr" : "auto"}
                  type={sensitive && !showReveal ? "password" : "text"}
                  autoComplete="off"
                  value={values[f.key] ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className={cn(sensitive && "pe-10 font-mono", invalid && "border-destructive")}
                />
                {sensitive && (
                  <button
                    type="button"
                    onClick={() => setReveal((p) => ({ ...p, [f.key]: !p[f.key] }))}
                    className="absolute inset-y-0 flex items-center px-3 text-muted-foreground hover:text-foreground ltr:right-0 rtl:left-0"
                    aria-label={showReveal ? "hide" : "show"}
                  >
                    {showReveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                )}
              </div>
            )}
            {invalid && <p className="text-xs text-destructive">{c.fieldRequired}</p>}
          </div>
        )
      })}

      <Button type="submit" disabled={submitting} className="w-full gap-2">
        <Send className="h-4 w-4" />
        {c.inputSubmit}
      </Button>
    </form>
  )
}
