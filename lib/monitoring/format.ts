import { formatNumber } from "@/lib/format"

/**
 * Format a metric value for display based on its registry unit. Pure and
 * client-safe (no server-only imports) so dashboard components can use it.
 */
export function formatMetricValue(value: number | null | undefined, unit?: string): string {
  if (value == null || Number.isNaN(value)) return "—"
  switch (unit) {
    case "percent":
      return `${value.toFixed(value < 10 ? 1 : 0)}٪`
    case "bytes":
      return formatBytes(value)
    case "bytesPerSec":
      return `${formatBytes(value)}/s`
    case "ms":
      return value >= 1000 ? `${(value / 1000).toFixed(2)} ثانیه` : `${Math.round(value)} ms`
    case "seconds":
      return formatDuration(value)
    case "rps":
      return `${value.toFixed(value < 10 ? 1 : 0)}/s`
    case "load":
      return value.toFixed(2)
    case "toman":
      return `${formatNumber(Math.round(value))} ت`
    case "count":
    case undefined:
    default:
      return formatNumber(Math.round(value))
  }
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} ثانیه`
  if (seconds < 3600) return `${Math.round(seconds / 60)} دقیقه`
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} ساعت`
  return `${Math.round(seconds / 86400)} روز`
}

/** Tailwind text-color class for a severity level. */
export function severityColor(severity: "ok" | "warn" | "critical"): string {
  if (severity === "critical") return "text-destructive"
  if (severity === "warn") return "text-chart-1"
  return "text-chart-2"
}

/** Service status → Persian label + color treatment. */
export const STATUS_META: Record<
  string,
  { label: string; dot: string; text: string; badge: string }
> = {
  UP: { label: "سالم", dot: "bg-chart-2", text: "text-chart-2", badge: "border-chart-2/30 bg-chart-2/10 text-chart-2" },
  DEGRADED: { label: "کند", dot: "bg-chart-1", text: "text-chart-1", badge: "border-chart-1/30 bg-chart-1/10 text-chart-1" },
  DOWN: { label: "قطع", dot: "bg-destructive", text: "text-destructive", badge: "border-destructive/30 bg-destructive/10 text-destructive" },
  UNKNOWN: { label: "نامشخص", dot: "bg-muted-foreground", text: "text-muted-foreground", badge: "border-border bg-secondary text-muted-foreground" },
}
