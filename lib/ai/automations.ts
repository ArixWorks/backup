import "server-only"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { runObject } from "./client"
import { dashboardStats } from "@/lib/core/admin"
import { createNotifications } from "@/lib/core/notifications"

/**
 * AI Automation registry. Each automation has a stable `key`, a default
 * cadence, and a `run` handler. Handlers are ADVISORY: they generate digests,
 * triage summaries and admin notifications — they never silently mutate
 * customer-facing data. The cron tick calls `runDueAutomations()`, which
 * enforces the per-automation interval and records every run.
 */

export type AutomationResult = {
  status: "ok" | "skipped"
  summary: string
  detail?: Record<string, unknown>
}

export type AutomationHandler = {
  key: string
  title: string
  description: string
  /** Default cadence in minutes; admins can override per automation. */
  defaultIntervalMin: number
  run: (ctx: { config: Record<string, unknown> }) => Promise<AutomationResult>
}

// --- Helpers ----------------------------------------------------------------

/** All admin user ids — the default recipients for automation notifications. */
async function adminUserIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  })
  return admins.map((a) => a.id)
}

async function notifyAdmins(input: {
  title: string
  body: string
  href?: string
}): Promise<number> {
  const ids = await adminUserIds()
  if (ids.length === 0) return 0
  await createNotifications(
    ids.map((userId) => ({
      userId,
      type: "GENERAL" as const,
      title: input.title,
      body: input.body,
      href: input.href,
    })),
  )
  return ids.length
}

// --- Handlers ---------------------------------------------------------------

const opsDigestSchema = z.object({
  headline: z.string().describe("یک جمله کوتاه که وضعیت کلی امروز را خلاصه می‌کند"),
  highlights: z.array(z.string()).max(5).describe("مهم‌ترین نکات قابل توجه"),
  actions: z.array(z.string()).max(5).describe("اقدامات پیشنهادی برای تیم مدیریت"),
})

/**
 * Daily operations digest: turns raw dashboard counters into a concise,
 * prioritized Persian brief and notifies admins.
 */
const opsDigest: AutomationHandler = {
  key: "daily_ops_digest",
  title: "خلاصه روزانه عملیات",
  description:
    "شاخص‌های داشبورد را به یک بریفینگ کوتاه و اولویت‌بندی‌شده تبدیل می‌کند و برای مدیران ارسال می‌کند.",
  defaultIntervalMin: 1440,
  run: async () => {
    const s = await dashboardStats()
    const facts = {
      کاربران: s.userCount,
      مزایده‌های_فعال: s.activeAuctions,
      واریزهای_در_انتظار: s.pendingDeposits,
      برداشت‌های_در_انتظار: s.pendingWithdrawals,
      تحویل‌های_در_انتظار: s.pendingDeliveries,
      تحویل‌های_ناموفق: s.failedDeliveries,
      بازپرداخت‌های_در_انتظار: s.pendingRefunds,
      تیکت‌های_باز: s.openTickets,
    }

    const { object } = await runObject({
      feature: "automation.ops_digest",
      schema: opsDigestSchema,
      // Automations run in the background: use the fast, low-latency model.
      tier: "fast",
      system:
        "تو دستیار عملیات یک فروشگاه دیجیتال هستی. بر اساس اعداد داده‌شده یک بریفینگ کوتاه، دقیق و عملیاتی به فارسی بنویس. اگر عددی نگران‌کننده است (مثل تحویل ناموفق یا بازپرداخت معوق) آن را برجسته کن.",
      prompt: `شاخص‌های امروز:\n${JSON.stringify(facts, null, 2)}`,
    })

    const recipients = await notifyAdmins({
      title: `بریفینگ روزانه: ${object.headline}`,
      body: object.highlights.join(" • ") || object.headline,
      href: "/admin",
    })

    return {
      status: "ok",
      summary: object.headline,
      detail: { ...object, recipients },
    }
  },
}

const triageSchema = z.object({
  summary: z.string().describe("خلاصه وضعیت تیکت‌های معوق"),
  urgent: z
    .array(z.object({ publicId: z.string(), reason: z.string() }))
    .max(10)
    .describe("تیکت‌هایی که نیاز به رسیدگی فوری دارند"),
})

/**
 * Stale-ticket triage: finds support tickets left OPEN/PENDING beyond the
 * configured age, asks the model to rank the most urgent, and alerts admins.
 */
const ticketTriage: AutomationHandler = {
  key: "stale_ticket_triage",
  title: "تریاژ تیکت‌های معوق",
  description:
    "تیکت‌های بازِ قدیمی را پیدا می‌کند، فوری‌ترین‌ها را اولویت‌بندی می‌کند و به مدیران هشدار می‌دهد.",
  defaultIntervalMin: 720,
  run: async ({ config }) => {
    const maxAgeHours = typeof config.maxAgeHours === "number" ? config.maxAgeHours : 24
    const cutoff = new Date(Date.now() - maxAgeHours * 3600_000)
    const stale = await prisma.supportTicket.findMany({
      where: { status: { in: ["OPEN", "PENDING"] }, updatedAt: { lt: cutoff } },
      orderBy: { updatedAt: "asc" },
      take: 25,
      select: {
        publicId: true,
        subject: true,
        category: true,
        updatedAt: true,
      },
    })

    if (stale.length === 0) {
      return { status: "skipped", summary: "تیکت معوقی یافت نشد." }
    }

    const { object } = await runObject({
      feature: "automation.ticket_triage",
      schema: triageSchema,
      tier: "fast",
      system:
        "تو مدیر پشتیبانی هستی. از فهرست تیکت‌های معوق، فوری‌ترین‌ها را بر اساس قدمت و دسته‌بندی انتخاب و دلیل را کوتاه بنویس.",
      prompt: `تیکت‌های معوق (بیش از ${maxAgeHours} ساعت بدون به‌روزرسانی):\n${JSON.stringify(
        stale.map((t) => ({
          publicId: t.publicId,
          subject: t.subject,
          category: t.category,
          ageHours: Math.round((Date.now() - t.updatedAt.getTime()) / 3600_000),
        })),
        null,
        2,
      )}`,
    })

    const recipients = await notifyAdmins({
      title: `تریاژ پشتیبانی: ${stale.length} تیکت معوق`,
      body: object.summary,
      href: "/admin/support",
    })

    return {
      status: "ok",
      summary: `${stale.length} تیکت معوق، ${object.urgent.length} فوری`,
      detail: { ...object, staleCount: stale.length, recipients },
    }
  },
}

export const AUTOMATION_HANDLERS: AutomationHandler[] = [opsDigest, ticketTriage]

export function getHandler(key: string): AutomationHandler | undefined {
  return AUTOMATION_HANDLERS.find((h) => h.key === key)
}

// --- Persistence + orchestration --------------------------------------------

/**
 * Ensure a DB row exists for every registered automation (idempotent). Called
 * lazily by the admin list endpoint and the cron runner so new handlers show up
 * without a manual migration/seed step.
 */
export async function syncAutomations(): Promise<void> {
  for (const h of AUTOMATION_HANDLERS) {
    await prisma.aiAutomation.upsert({
      where: { key: h.key },
      create: { key: h.key, intervalMin: h.defaultIntervalMin, enabled: false },
      update: {},
    })
  }
}

/** Execute a single automation now, recording the run. Used by cron + manual run. */
export async function executeAutomation(key: string): Promise<AutomationResult> {
  const handler = getHandler(key)
  if (!handler) throw new Error(`اتوماسیون ناشناخته: ${key}`)
  const row = await prisma.aiAutomation.findUnique({ where: { key } })
  const config = (row?.config as Record<string, unknown> | null) ?? {}

  const startedAt = Date.now()
  try {
    const result = await handler.run({ config })
    const now = new Date()
    await prisma.$transaction([
      prisma.aiAutomationRun.create({
        data: {
          automationId: row!.id,
          status: result.status,
          summary: result.summary,
          detail: (result.detail ?? undefined) as never,
          durationMs: Date.now() - startedAt,
        },
      }),
      prisma.aiAutomation.update({
        where: { id: row!.id },
        data: {
          lastRunAt: now,
          nextRunAt: new Date(now.getTime() + (row!.intervalMin || 1440) * 60_000),
          lastStatus: result.status,
        },
      }),
    ])
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.log(`[v0] automation ${key} failed:`, message)
    if (row) {
      await prisma.aiAutomationRun.create({
        data: {
          automationId: row.id,
          status: "error",
          error: message.slice(0, 500),
          durationMs: Date.now() - startedAt,
        },
      })
      await prisma.aiAutomation.update({
        where: { id: row.id },
        data: { lastRunAt: new Date(), lastStatus: "error" },
      })
    }
    throw err
  }
}

/**
 * Run all enabled automations whose interval has elapsed. Called from the cron
 * tick. Each automation is isolated: one failure never blocks the others.
 */
export async function runDueAutomations(): Promise<{
  ran: number
  results: { key: string; status: string; summary?: string }[]
}> {
  await syncAutomations()
  const now = new Date()
  const due = await prisma.aiAutomation.findMany({
    where: {
      enabled: true,
      OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
    },
  })

  const results: { key: string; status: string; summary?: string }[] = []
  for (const a of due) {
    try {
      const r = await executeAutomation(a.key)
      results.push({ key: a.key, status: r.status, summary: r.summary })
    } catch (err) {
      results.push({
        key: a.key,
        status: "error",
        summary: err instanceof Error ? err.message : "error",
      })
    }
  }
  return { ran: results.length, results }
}

/** Admin list view: registered handlers joined with their DB state + last run. */
export async function listAutomations() {
  await syncAutomations()
  const rows = await prisma.aiAutomation.findMany({
    include: { runs: { orderBy: { createdAt: "desc" }, take: 1 } },
  })
  const byKey = new Map(rows.map((r) => [r.key, r]))
  return AUTOMATION_HANDLERS.map((h) => {
    const row = byKey.get(h.key)!
    return {
      key: h.key,
      title: h.title,
      description: h.description,
      enabled: row.enabled,
      intervalMin: row.intervalMin,
      config: row.config ?? {},
      lastRunAt: row.lastRunAt?.toISOString() ?? null,
      nextRunAt: row.nextRunAt?.toISOString() ?? null,
      lastStatus: row.lastStatus ?? null,
      lastRun: row.runs[0]
        ? {
            status: row.runs[0].status,
            summary: row.runs[0].summary,
            error: row.runs[0].error,
            createdAt: row.runs[0].createdAt.toISOString(),
          }
        : null,
    }
  })
}

export async function updateAutomation(
  key: string,
  input: { enabled?: boolean; intervalMin?: number; config?: Record<string, unknown> },
) {
  await syncAutomations()
  const now = new Date()
  const data: {
    enabled?: boolean
    intervalMin?: number
    config?: Record<string, unknown>
    nextRunAt?: Date
  } = {}
  if (input.enabled !== undefined) {
    data.enabled = input.enabled
    // When enabling, schedule the first run immediately.
    if (input.enabled) data.nextRunAt = now
  }
  if (input.intervalMin !== undefined) data.intervalMin = input.intervalMin
  if (input.config !== undefined) data.config = input.config
  return prisma.aiAutomation.update({ where: { key }, data: data as never })
}

/** Recent run history across all automations for the admin activity feed. */
export async function listRecentRuns(limit = 20) {
  const runs = await prisma.aiAutomationRun.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { automation: { select: { key: true } } },
  })
  return runs.map((r) => ({
    id: r.id,
    key: r.automation.key,
    status: r.status,
    summary: r.summary,
    error: r.error,
    durationMs: r.durationMs,
    createdAt: r.createdAt.toISOString(),
  }))
}
