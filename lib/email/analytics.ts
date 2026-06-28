import "server-only"
import { EmailStatus, type EmailTemplateKey } from "@prisma/client"
import { prisma } from "@/lib/db"

export type EmailStats = {
  windowDays: number
  total: number
  byStatus: Record<string, number>
  sent: number
  delivered: number
  failed: number
  bounced: number
  complained: number
  queued: number
  deliveryRate: number // delivered / (sent attempts that resolved)
  bounceRate: number
  openRate: number
  clickRate: number
  opens: number
  clicks: number
}

/** Aggregate delivery metrics over a trailing window (default 30 days). */
export async function getEmailStats(windowDays = 30): Promise<EmailStats> {
  const since = new Date(Date.now() - windowDays * 86_400_000)

  const grouped = await prisma.emailJob.groupBy({
    by: ["status"],
    where: { queuedAt: { gte: since } },
    _count: { _all: true },
  })

  const byStatus: Record<string, number> = {}
  for (const g of grouped) byStatus[g.status] = g._count._all

  const get = (s: EmailStatus) => byStatus[s] ?? 0
  const sent = get(EmailStatus.SENT)
  const delivered = get(EmailStatus.DELIVERED)
  const failed = get(EmailStatus.FAILED)
  const bounced = get(EmailStatus.BOUNCED)
  const complained = get(EmailStatus.COMPLAINED)
  const queued = get(EmailStatus.QUEUED) + get(EmailStatus.PROCESSING)
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0)

  const agg = await prisma.emailJob.aggregate({
    where: { queuedAt: { gte: since } },
    _sum: { openCount: true, clickCount: true },
    _count: { openedAt: true, clickedAt: true },
  })
  const opens = agg._sum.openCount ?? 0
  const clicks = agg._sum.clickCount ?? 0
  const openedJobs = agg._count.openedAt ?? 0
  const clickedJobs = agg._count.clickedAt ?? 0

  // "Resolved successful" = anything that reached the provider.
  const reachedProvider = sent + delivered + bounced + complained
  const resolved = reachedProvider + failed
  const deliveryRate = resolved > 0 ? reachedProvider / resolved : 0
  const bounceRate = reachedProvider > 0 ? bounced / reachedProvider : 0
  const openRate = reachedProvider > 0 ? openedJobs / reachedProvider : 0
  const clickRate = openedJobs > 0 ? clickedJobs / openedJobs : 0

  return {
    windowDays,
    total,
    byStatus,
    sent,
    delivered,
    failed,
    bounced,
    complained,
    queued,
    deliveryRate,
    bounceRate,
    openRate,
    clickRate,
    opens,
    clicks,
  }
}

export type TemplateBreakdown = { template: EmailTemplateKey; count: number }[]

/** Per-template volume over the window, most-used first. */
export async function getTemplateBreakdown(windowDays = 30): Promise<TemplateBreakdown> {
  const since = new Date(Date.now() - windowDays * 86_400_000)
  const grouped = await prisma.emailJob.groupBy({
    by: ["template"],
    where: { queuedAt: { gte: since } },
    _count: { _all: true },
    orderBy: { _count: { template: "desc" } },
  })
  return grouped.map((g) => ({ template: g.template, count: g._count._all }))
}

/**
 * Bounce rate (percent, 0..100) over the last 24h, for the Ops Center metric.
 * Denominator is everything that reached the provider (sent+delivered+bounced).
 */
export async function readEmailBounceRate(): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [bounced, reached] = await Promise.all([
    prisma.emailJob.count({ where: { status: "BOUNCED", updatedAt: { gte: since } } }),
    prisma.emailJob.count({
      where: { status: { in: ["SENT", "DELIVERED", "BOUNCED"] }, updatedAt: { gte: since } },
    }),
  ])
  if (reached === 0) return 0
  return Math.round((bounced / reached) * 1000) / 10
}

/** Daily sent counts for a sparkline/area chart. */
export async function getDailyVolume(windowDays = 14): Promise<{ date: string; count: number }[]> {
  const since = new Date(Date.now() - windowDays * 86_400_000)
  const rows = await prisma.$queryRaw<{ date: string; count: bigint }[]>`
    SELECT to_char(date_trunc('day', "queuedAt"), 'YYYY-MM-DD') AS date, count(*)::bigint AS count
    FROM "EmailJob"
    WHERE "queuedAt" >= ${since}
    GROUP BY 1
    ORDER BY 1 ASC
  `
  return rows.map((r) => ({ date: r.date, count: Number(r.count) }))
}
