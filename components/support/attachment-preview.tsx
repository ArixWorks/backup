"use client"

import { useState } from "react"
import { FileText, FileType, Download, X } from "lucide-react"

export type TicketAttachment = {
  id: string
  kind: "IMAGE" | "PDF" | "TEXT"
  url: string
  name: string
  mimeType: string
  size: number
  width?: number | null
  height?: number | null
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Renders a message's attachments inside the chat bubble — identical in the
 * live composer preview and in historical messages after a refresh.
 *  - IMAGE → small clickable thumbnail that opens a full-size lightbox.
 *  - PDF/TEXT → compact card with a format-specific icon, name, size and a
 *    download action (files are always served as downloads by the proxy).
 */
export function AttachmentPreview({ attachments }: { attachments: TicketAttachment[] }) {
  const [lightbox, setLightbox] = useState<TicketAttachment | null>(null)
  if (!attachments || attachments.length === 0) return null

  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2">
        {attachments.map((a) =>
          a.kind === "IMAGE" ? (
            <button
              key={a.id}
              type="button"
              onClick={() => setLightbox(a)}
              className="group relative h-24 w-24 overflow-hidden rounded-xl border border-border bg-muted transition-transform hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`نمایش تصویر ${a.name}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.url || "/placeholder.svg"}
                alt={a.name}
                className="h-full w-full object-cover"
                loading="lazy"
                crossOrigin="anonymous"
              />
            </button>
          ) : (
            <a
              key={a.id}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              download={a.name}
              className="flex min-w-44 max-w-64 items-center gap-2.5 rounded-xl border border-border bg-background/60 px-3 py-2 transition-colors hover:bg-accent"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  a.kind === "PDF" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"
                }`}
              >
                {a.kind === "PDF" ? <FileType className="h-4.5 w-4.5" /> : <FileText className="h-4.5 w-4.5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span dir="auto" className="block truncate text-xs font-medium">
                  {a.name}
                </span>
                <span className="block text-[10px] text-muted-foreground">
                  {a.kind} · {formatSize(a.size)}
                </span>
              </span>
              <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
            </a>
          ),
        )}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            onClick={() => setLightbox(null)}
            aria-label="بستن"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.url || "/placeholder.svg"}
            alt={lightbox.name}
            className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl animate-in zoom-in-95"
            crossOrigin="anonymous"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}
