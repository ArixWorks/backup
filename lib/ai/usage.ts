import "server-only"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { estimateCostMicroUsd } from "./pricing"

/**
 * Usage / token / cost observability. Every gateway call records one
 * AiUsageEvent (success or failure) so nothing bypasses tracking. Also exposes
 * the aggregate queries powering the admin cost analytics + guardrails.
 */

export interface RecordUsageInput {
  feature: string
  provider: string
  model: string
  operation?: string
  userId?: string | null
  refType?: string | null
  refId?: string | null
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  latencyMs?: number
  ok: boolean
  errorCode?: string | null
  errorMessage?: string | null
  meta?: Prisma.InputJsonValue
}

export async function recordUsage(input: RecordUsageInput): Promise<void> {
  const inputTokens = input.inputTokens ?? undefined
  const outputTokens = input.outputTokens ?? undefined
  const totalTokens =
    input.totalTokens ?? ((inputTokens ?? 0) + (outputTokens ?? 0) || undefined)
  const costMicroUsd = estimateCostMicroUsd(input.model, inputTokens ?? 0, outputTokens ?? 0)
  try {
    await prisma.aiUsageEvent.create({
      data: {
        feature: input.feature,
        provider: input.provider,
        model: input.model,
        operation: input.operation ?? "generateText",
        userId: input.userId ?? null,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        inputTokens: inputTokens ?? null,
        outputTokens: outputTokens ?? null,
        totalTokens: totalTokens ?? null,
        costMicroUsd,
        latencyMs: input.latencyMs ?? null,
        ok: input.ok,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
        meta: input.meta,
      },
    })
  } catch (err) {
    // Never let observability break a generation.
    console.log("[v0] recordUsage failed:", err)
  }
}

function startOfTodayUtc(): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/** Platform-wide totals since UTC midnight (for daily guardrails). */
export async function getTodayTotals(): Promise<{ tokens: number; costUsd: number }> {
  const agg = await prisma.aiUsageEvent.aggregate({
    where: { createdAt: { gte: startOfTodayUtc() }, ok: true },
    _sum: { totalTokens: true, costMicroUsd: true },
  })
  return {
    tokens: agg._sum.totalTokens ?? 0,
    costUsd: Number(agg._sum.costMicroUsd ?? 0n) / 1_000_000,
  }
}

export interface UsageSummary {
  totalCalls: number
  okCalls: number
  errorCalls: number
  totalTokens: number
  totalCostUsd: number
  today: { tokens: number; costUsd: number }
  byFeature: { feature: string; calls: number; tokens: number; costUsd: number }[]
  byModel: { model: string; calls: number; tokens: number; costUsd: number }[]
  recent: {
    id: string
    feature: string
    model: string
    provider: string
    ok: boolean
    totalTokens: number | null
    costUsd: number
    latencyMs: number | null
    errorMessage: string | null
    createdAt: Date
  }[]
}

/** Full usage summary for the admin AI analytics panel. */
export async function getUsageSummary(days = 30): Promise<UsageSummary> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const [all, byFeatureRaw, byModelRaw, recent, today] = await Promise.all([
    prisma.aiUsageEvent.aggregate({
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { totalTokens: true, costMicroUsd: true },
    }),
    prisma.aiUsageEvent.groupBy({
      by: ["feature"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { totalTokens: true, costMicroUsd: true },
    }),
    prisma.aiUsageEvent.groupBy({
      by: ["model"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { totalTokens: true, costMicroUsd: true },
    }),
    prisma.aiUsageEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    getTodayTotals(),
  ])
  const okCalls = await prisma.aiUsageEvent.count({
    where: { createdAt: { gte: since }, ok: true },
  })
  const totalCalls = all._count._all
  return {
    totalCalls,
    okCalls,
    errorCalls: totalCalls - okCalls,
    totalTokens: all._sum.totalTokens ?? 0,
    totalCostUsd: Number(all._sum.costMicroUsd ?? 0n) / 1_000_000,
    today,
    byFeature: byFeatureRaw
      .map((r) => ({
        feature: r.feature,
        calls: r._count._all,
        tokens: r._sum.totalTokens ?? 0,
        costUsd: Number(r._sum.costMicroUsd ?? 0n) / 1_000_000,
      }))
      .sort((a, b) => b.costUsd - a.costUsd),
    byModel: byModelRaw
      .map((r) => ({
        model: r.model,
        calls: r._count._all,
        tokens: r._sum.totalTokens ?? 0,
        costUsd: Number(r._sum.costMicroUsd ?? 0n) / 1_000_000,
      }))
      .sort((a, b) => b.costUsd - a.costUsd),
    recent: recent.map((r) => ({
      id: r.id,
      feature: r.feature,
      model: r.model,
      provider: r.provider,
      ok: r.ok,
      totalTokens: r.totalTokens,
      costUsd: Number(r.costMicroUsd) / 1_000_000,
      latencyMs: r.latencyMs,
      errorMessage: r.errorMessage,
      createdAt: r.createdAt,
    })),
  }
}
