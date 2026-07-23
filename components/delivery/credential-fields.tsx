"use client"

/**
 * Unified renderer for a delivered credential payload. Renders a { key: value }
 * map against an optional field template: localized labels, LTR mono values,
 * copy-to-clipboard rows, and masked reveal for sensitive fields. Shared by the
 * orders page, the giveaway wins page, and (later) auction win delivery.
 */

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Copy, Eye, EyeOff, KeyRound } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import type { MessageKey } from "@/lib/i18n/messages"
import {
  fieldLabel,
  type DeliveryFieldDef,
  type DeliveryTemplate,
} from "@/lib/core/delivery-fields"

/** Fallback labels for well-known keys when no template field matches. */
const FALLBACK_LABELS: Record<string, MessageKey> = {
  username: "payload.username",
  password: "payload.password",
  email: "payload.email",
  licenseKey: "payload.licenseKey",
  code: "payload.code",
  note: "payload.note",
  url: "payload.url",
}

/** Keys that should be masked by default even without a template. */
const SENSITIVE_KEYS = new Set(["password", "licenseKey", "code", "secret", "pin"])

type Row = {
  key: string
  label: string
  value: string
  sensitive: boolean
  multiline: boolean
}

function CredentialRow({ row }: { row: Row }) {
  const { t } = useI18n()
  const [revealed, setRevealed] = useState(!row.sensitive)

  function copy() {
    navigator.clipboard.writeText(row.value).then(
      () => toast.success(t("wins.copied")),
      () => toast.error(t("wins.copyFailed")),
    )
  }

  if (row.multiline) {
    return (
      <div className="px-3 py-2.5">
        <dt className="mb-1 text-xs text-muted-foreground">{row.label}</dt>
        <dd className="flex items-start justify-between gap-2">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed" dir="auto">
            {row.value}
          </p>
          <button
            type="button"
            onClick={copy}
            aria-label={t("wins.copy")}
            className="mt-0.5 shrink-0 text-muted-foreground transition hover:text-primary"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </dd>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <dt className="shrink-0 text-xs text-muted-foreground">{row.label}</dt>
      <dd className="flex min-w-0 items-center gap-2">
        <span className="truncate text-left font-mono text-sm" dir="ltr">
          {revealed ? row.value : "•".repeat(Math.min(12, Math.max(6, row.value.length)))}
        </span>
        {row.sensitive && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? t("delivery.hide") : t("delivery.reveal")}
            className="shrink-0 text-muted-foreground transition hover:text-primary"
          >
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        )}
        <button
          type="button"
          onClick={copy}
          aria-label={t("wins.copy")}
          className="shrink-0 text-muted-foreground transition hover:text-primary"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </dd>
    </div>
  )
}

export function CredentialFields({
  payload,
  template,
  title,
  className,
}: {
  payload: Record<string, unknown> | string | null | undefined
  template?: DeliveryTemplate | null
  title?: string
  className?: string
}) {
  const { t, locale } = useI18n()

  const rows = useMemo<Row[]>(() => {
    if (!payload || typeof payload === "string") return []
    const byKey = new Map<string, DeliveryFieldDef>()
    for (const f of template ?? []) byKey.set(f.key, f)

    // Order: template order first, then any extra payload keys not in template.
    const orderedKeys: string[] = []
    for (const f of template ?? []) {
      if (f.type !== "totp") orderedKeys.push(f.key)
    }
    for (const k of Object.keys(payload)) if (!orderedKeys.includes(k)) orderedKeys.push(k)

    const result: Row[] = []
    for (const key of orderedKeys) {
      const raw = (payload as Record<string, unknown>)[key]
      if (raw == null || String(raw).trim() === "") continue
      const def = byKey.get(key)
      const label = def
        ? fieldLabel(def, locale)
        : FALLBACK_LABELS[key]
          ? t(FALLBACK_LABELS[key])
          : key
      const sensitive = def?.sensitive ?? SENSITIVE_KEYS.has(key)
      const multiline = def?.type === "note" || key === "note"
      result.push({ key, label, value: String(raw), sensitive, multiline })
    }
    return result
  }, [payload, template, locale, t])

  // Plain-string payloads (legacy manual messages) render as a preformatted note.
  if (typeof payload === "string") {
    return (
      <pre
        className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-border bg-secondary/60 p-3 text-left font-mono text-sm"
        dir="auto"
      >
        {payload}
      </pre>
    )
  }

  if (rows.length === 0) return null

  return (
    <div className={`overflow-hidden rounded-lg border border-border bg-secondary/60 ${className ?? ""}`}>
      {title && (
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-semibold text-foreground">
          <KeyRound className="h-4 w-4 text-primary" />
          {title}
        </div>
      )}
      <dl className="divide-y divide-border">
        {rows.map((row) => (
          <CredentialRow key={row.key} row={row} />
        ))}
      </dl>
    </div>
  )
}
