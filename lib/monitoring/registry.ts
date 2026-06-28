/**
 * Central registry for the Operations Center.
 *
 * Everything modular lives here: the list of monitored SERVICES and the
 * catalog of METRICS (with units, categories and alert thresholds). To monitor
 * a new service or metric, add one entry here — collection, health, dashboards
 * and alerts all read from this registry.
 *
 * This file is intentionally framework-free and safe to import from both server
 * and client code (no Node-only or DB imports).
 */

export type MetricCategory = "infra" | "app" | "business"

export type MetricUnit =
  | "percent"
  | "ms"
  | "count"
  | "bytes"
  | "bytesPerSec"
  | "rps"
  | "ratio"
  | "toman"
  | "load"
  | "seconds"

export type ThresholdDirection = "GT" | "LT"

export interface MetricDef {
  /** Stable key, e.g. "system.cpu.usage". Used everywhere as the metric id. */
  name: string
  /** Persian label shown in the UI. */
  label: string
  unit: MetricUnit
  category: MetricCategory
  /** Warning threshold (compared using `direction`). */
  warn?: number
  /** Critical threshold (compared using `direction`). */
  critical?: number
  /** "GT" = higher is worse (default), "LT" = lower is worse. */
  direction?: ThresholdDirection
  /** Short description for tooltips. */
  description?: string
}

export type ServiceKind =
  | "frontend"
  | "backend"
  | "worker"
  | "datastore"
  | "external"
  | "messaging"

export interface ServiceDef {
  /** Stable key, e.g. "postgres". */
  key: string
  label: string
  kind: ServiceKind
  /** Whether this service counts toward the overall platform health score. */
  critical?: boolean
  /**
   * Optional external ping. `urlEnv` names an env var holding the URL so the
   * target is configurable per environment without code changes.
   */
  ping?: { urlEnv: string; method?: "GET" | "HEAD"; expectStatus?: number }
}

// ---------------------------------------------------------------------------
// Services — the components we monitor across the whole ecosystem.
// ---------------------------------------------------------------------------

export const SERVICES: ServiceDef[] = [
  { key: "web", label: "وب‌سایت", kind: "frontend", critical: true },
  { key: "miniapp", label: "مینی‌اپ تلگرام", kind: "frontend", critical: true },
  { key: "admin", label: "داشبورد ادمین", kind: "frontend" },
  { key: "api", label: "REST API", kind: "backend", critical: true },
  { key: "ws", label: "سرور WebSocket", kind: "messaging" },
  { key: "queue", label: "صف کارها", kind: "worker" },
  { key: "worker", label: "Worker پس‌زمینه", kind: "worker" },
  { key: "cron", label: "زمان‌بند (Cron)", kind: "worker", critical: true },
  { key: "postgres", label: "PostgreSQL", kind: "datastore", critical: true },
  { key: "redis", label: "Redis", kind: "datastore" },
  { key: "nginx", label: "Reverse Proxy", kind: "backend", ping: { urlEnv: "OPS_PING_NGINX_URL" } },
  { key: "bot", label: "ربات تلگرام", kind: "messaging", critical: true },
  { key: "webhook", label: "Webhook تلگرام", kind: "messaging" },
  { key: "email", label: "سرویس ایمیل", kind: "external" },
  { key: "payments", label: "درگاه پرداخت", kind: "external", ping: { urlEnv: "OPS_PING_PAYMENTS_URL" } },
  { key: "external_api", label: "APIهای خارجی", kind: "external", ping: { urlEnv: "OPS_PING_EXTERNAL_URL" } },
]

export function serviceDef(key: string): ServiceDef | undefined {
  return SERVICES.find((s) => s.key === key)
}

// ---------------------------------------------------------------------------
// Metrics — the catalog of everything we sample.
// ---------------------------------------------------------------------------

export const METRICS: MetricDef[] = [
  // ---- Infrastructure -----------------------------------------------------
  { name: "system.cpu.usage", label: "مصرف CPU", unit: "percent", category: "infra", warn: 75, critical: 90, description: "درصد استفاده از پردازنده" },
  { name: "system.cpu.load1", label: "بار سیستم (۱ دقیقه)", unit: "load", category: "infra", warn: 4, critical: 8 },
  { name: "system.mem.usage", label: "مصرف حافظه", unit: "percent", category: "infra", warn: 80, critical: 92 },
  { name: "system.mem.used", label: "حافظه استفاده‌شده", unit: "bytes", category: "infra" },
  { name: "system.disk.usage", label: "مصرف دیسک", unit: "percent", category: "infra", warn: 80, critical: 92 },
  { name: "system.disk.io.read", label: "خواندن دیسک", unit: "bytesPerSec", category: "infra" },
  { name: "system.disk.io.write", label: "نوشتن دیسک", unit: "bytesPerSec", category: "infra" },
  { name: "system.net.rx", label: "ترافیک ورودی", unit: "bytesPerSec", category: "infra" },
  { name: "system.net.tx", label: "ترافیک خروجی", unit: "bytesPerSec", category: "infra" },
  { name: "system.net.latency", label: "تأخیر شبکه", unit: "ms", category: "infra", warn: 150, critical: 400 },
  { name: "system.fd.open", label: "File Descriptorها", unit: "count", category: "infra" },
  { name: "system.proc.count", label: "پردازه‌های فعال", unit: "count", category: "infra" },
  { name: "system.uptime", label: "آپ‌تایم سرور", unit: "seconds", category: "infra" },

  // ---- Application --------------------------------------------------------
  { name: "app.rps", label: "درخواست بر ثانیه", unit: "rps", category: "app" },
  { name: "app.error_rate", label: "نرخ خطا", unit: "percent", category: "app", warn: 2, critical: 5 },
  { name: "app.latency.p50", label: "تأخیر API (میانه)", unit: "ms", category: "app", warn: 300, critical: 800 },
  { name: "app.latency.p95", label: "تأخیر API (p95)", unit: "ms", category: "app", warn: 800, critical: 2000 },
  { name: "app.active_sessions", label: "نشست‌های فعال", unit: "count", category: "app" },
  { name: "app.active_users", label: "کاربران آنلاین", unit: "count", category: "app" },
  { name: "app.queue.size", label: "اندازه صف", unit: "count", category: "app", warn: 100, critical: 500 },
  { name: "app.queue.latency", label: "زمان پردازش صف", unit: "ms", category: "app", warn: 5000, critical: 15000 },
  { name: "app.ws.connections", label: "اتصالات WebSocket", unit: "count", category: "app" },
  { name: "app.cron.duration", label: "زمان اجرای Cron", unit: "ms", category: "app", warn: 20000, critical: 50000 },
  { name: "app.cron.failures", label: "Cronهای ناموفق", unit: "count", category: "app", warn: 1, critical: 3 },
  { name: "email.queue.size", label: "صف ایمیل", unit: "count", category: "app", warn: 100, critical: 500, description: "ایمیل‌های در انتظار ارسال" },
  { name: "email.failed", label: "ایمیل‌های ناموفق", unit: "count", category: "app", warn: 5, critical: 20, description: "ایمیل‌های ناموفق در ۲۴ ساعت اخیر" },
  { name: "email.bounce_rate", label: "نرخ برگشت ایمیل", unit: "percent", category: "app", warn: 5, critical: 10, description: "درصد ایمیل‌های برگشت‌خورده (۲۴ ساعت)" },
  { name: "db.latency", label: "تأخیر PostgreSQL", unit: "ms", category: "app", warn: 100, critical: 400 },
  { name: "db.pool.used", label: "اتصالات استخر DB", unit: "count", category: "app", warn: 15, critical: 20 },
  { name: "db.slow_queries", label: "کوئری‌های کند", unit: "count", category: "app", warn: 5, critical: 20 },
  { name: "redis.latency", label: "تأخیر Redis", unit: "ms", category: "app", warn: 50, critical: 200 },
  { name: "cache.hit_ratio", label: "نرخ Hit کش", unit: "percent", category: "app", warn: 70, critical: 50, direction: "LT" },

  // ---- Business -----------------------------------------------------------
  { name: "biz.orders_per_min", label: "سفارش در دقیقه", unit: "count", category: "business" },
  { name: "biz.revenue_window", label: "درآمد (بازه)", unit: "toman", category: "business" },
  { name: "biz.wallet_tx_per_min", label: "تراکنش کیف‌پول/دقیقه", unit: "count", category: "business" },
  { name: "biz.active_users", label: "کاربران فعال", unit: "count", category: "business" },
  { name: "biz.giveaway_activity", label: "فعالیت قرعه‌کشی", unit: "count", category: "business" },
  { name: "biz.auction_activity", label: "فعالیت مزایده", unit: "count", category: "business" },
  { name: "biz.referral_conversions", label: "تبدیل دعوت", unit: "count", category: "business" },
  { name: "biz.vip_members", label: "اعضای ویژه", unit: "count", category: "business" },
]

const METRIC_BY_NAME = new Map(METRICS.map((m) => [m.name, m]))

export function metricDef(name: string): MetricDef | undefined {
  return METRIC_BY_NAME.get(name)
}

export function metricsByCategory(category: MetricCategory): MetricDef[] {
  return METRICS.filter((m) => m.category === category)
}

/**
 * Classify a value against a metric's thresholds. Respects `direction`
 * (LT means a lower value is worse, e.g. cache hit ratio).
 */
export function metricSeverity(name: string, value: number): "ok" | "warn" | "critical" {
  const def = metricDef(name)
  if (!def) return "ok"
  const dir = def.direction ?? "GT"
  const breached = (threshold?: number) => {
    if (threshold == null) return false
    return dir === "GT" ? value >= threshold : value <= threshold
  }
  if (breached(def.critical)) return "critical"
  if (breached(def.warn)) return "warn"
  return "ok"
}
