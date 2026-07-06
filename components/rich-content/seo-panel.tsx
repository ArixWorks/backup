"use client"

import { useMemo } from "react"
import { analyzeSeo, type SeoReport } from "@/lib/rich-content/seo"
import { cn } from "@/lib/utils"
import { AlertTriangle, CheckCircle2, Info, Clock, FileText, Type } from "lucide-react"

/**
 * Live SEO Assistant panel. Pure client-side analysis of the current HTML —
 * advisory only, it never blocks saving. Reads word count, reading time,
 * heading structure, missing alt, links, keyword density, and meta/title hints.
 */
export function SeoPanel({
  html,
  title,
  metaDescription,
  keyword,
}: {
  html: string
  title?: string
  metaDescription?: string
  keyword?: string
}) {
  const report: SeoReport = useMemo(
    () => analyzeSeo(html, { title, metaDescription, keyword }),
    [html, title, metaDescription, keyword],
  )

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="grid grid-cols-3 gap-2">
        <Stat icon={<FileText className="size-4" />} label="کلمات" value={String(report.wordCount)} />
        <Stat icon={<Clock className="size-4" />} label="زمان مطالعه" value={`${report.readingTimeMin} دقیقه`} />
        <Stat icon={<Type className="size-4" />} label="سرفصل‌ها" value={String(report.headings.length)} />
      </div>

      <div className="flex flex-col gap-2">
        {report.issues.map((issue) => (
          <div
            key={issue.id + issue.message}
            className={cn(
              "flex items-start gap-2 rounded-lg border p-2.5",
              issue.severity === "good" && "border-border bg-muted/40",
              issue.severity === "warn" && "border-[oklch(0.8_0.15_85)]/40 bg-[oklch(0.8_0.15_85)]/10",
              issue.severity === "error" && "border-destructive/40 bg-destructive/10",
            )}
          >
            <span className="mt-0.5 flex-none">
              {issue.severity === "good" && <CheckCircle2 className="size-4 text-[oklch(0.72_0.16_150)]" />}
              {issue.severity === "warn" && <AlertTriangle className="size-4 text-[oklch(0.72_0.14_85)]" />}
              {issue.severity === "error" && <AlertTriangle className="size-4 text-destructive" />}
            </span>
            <span className="text-foreground">{issue.message}</span>
          </div>
        ))}
      </div>

      {report.headings.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Info className="size-3.5" /> ساختار سرفصل‌ها
          </div>
          <ul className="flex flex-col gap-1">
            {report.headings.map((h, i) => (
              <li
                key={i}
                className="truncate text-xs text-foreground/80"
                style={{ paddingInlineStart: `${(h.level - 1) * 12}px` }}
              >
                <span className="text-muted-foreground">H{h.level}</span> {h.text || "—"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card p-2 text-center">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  )
}
