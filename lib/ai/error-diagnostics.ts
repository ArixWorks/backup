import "server-only"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/core/audit"
import { runObject } from "./client"

const diagnosisSchema = z.object({
  area: z.string().min(2).max(120),
  likelyFile: z.string().max(300).nullable(),
  likelyFunction: z.string().max(160).nullable(),
  rootCause: z.string().min(10).max(2000),
  impact: z.string().min(5).max(1000),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string().min(2).max(500)).min(1).max(8),
  steps: z.array(z.string().min(2).max(500)).min(1).max(10),
  canAutoFix: z.boolean(),
})

function sanitize(value: unknown, max = 8000): string {
  return String(value ?? "")
    .replace(/(?:api[_-]?key|authorization|cookie|token|secret|password)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [REDACTED]")
    .replace(/[A-Za-z0-9+/]{32,}={0,2}/g, "[REDACTED]")
    .slice(0, max)
}

export async function diagnoseErrorEvent(errorEventId: string, adminId: string) {
  const event = await prisma.errorEvent.findUnique({
    where: { id: errorEventId },
    include: { diagnoses: { orderBy: { createdAt: "desc" }, take: 1 } },
  })
  if (!event) throw new Error("خطا پیدا نشد")

  const latest = event.diagnoses[0]
  if (latest?.status === "RUNNING") return latest

  const context = event.context && typeof event.context === "object" ? JSON.stringify(event.context) : "{}"
  const knownPrismaHint = /Unknown field `variants`|Unknown field variants/i.test(event.message + (event.stack ?? ""))
    ? "Known code hint: inspect the flash product detail query in lib/core/flash-sale.ts and Product relations in prisma/schema.prisma. The runtime Prisma client may not expose Product.variants."
    : ""

  const pending = await prisma.errorDiagnosis.create({
    data: {
      errorEventId: event.id,
      status: "RUNNING",
      area: "در حال تشخیص",
      rootCause: "تحلیل AI در حال اجرا است",
      impact: "در حال بررسی",
      confidence: 0,
      evidence: [],
      steps: [],
      diagnosedById: adminId,
    },
  })

  try {
    const result = await runObject({
      feature: "ops.error-diagnosis",
      tier: "default",
      userId: adminId,
      refType: "error_event",
      refId: event.id,
      temperature: 0.1,
      maxTokens: 1800,
      schema: diagnosisSchema,
      system: "You are a senior production incident diagnostician. Return precise Persian analysis. Never claim a fix was executed. Identify the affected subsystem and source location only when supported by evidence. Recommendations must be safe, ordered, and verifiable. canAutoFix means only that a patch could be prepared after explicit owner approval; it never authorizes execution.",
      prompt: `Analyze this sanitized production incident.\nSource: ${event.source}\nLevel: ${sanitize(event.level, 40)}\nName: ${sanitize(event.name, 200)}\nMessage: ${sanitize(event.message, 3000)}\nStack: ${sanitize(event.stack, 7000)}\nContext: ${sanitize(context, 2500)}\nRelease: ${sanitize(event.release, 200)}\nFirst seen: ${event.firstSeenAt.toISOString()}\nLast seen: ${event.lastSeenAt.toISOString()}\nOccurrences: ${event.count}\nResolved: ${event.resolved}\n${knownPrismaHint}`,
    })

    const saved = await prisma.errorDiagnosis.update({
      where: { id: pending.id },
      data: {
        status: "COMPLETED",
        model: result.model,
        provider: "vercel-ai-gateway",
        area: result.object.area,
        likelyFile: result.object.likelyFile,
        likelyFunction: result.object.likelyFunction,
        rootCause: result.object.rootCause,
        impact: result.object.impact,
        confidence: result.object.confidence,
        evidence: result.object.evidence,
        steps: result.object.steps,
        canAutoFix: result.object.canAutoFix,
      },
    })
    await audit({ actorId: adminId, action: "ops.error.diagnose", entity: "ErrorEvent", entityId: event.id, meta: { diagnosisId: saved.id, model: saved.model } })
    return saved
  } catch (error) {
    const failureReason = error instanceof Error ? sanitize(error.message, 500) : "سرویس تحلیل AI در دسترس نیست"
    const failed = await prisma.errorDiagnosis.update({
      where: { id: pending.id },
      data: {
        status: "FAILED",
        area: "نامشخص",
        rootCause: "تحلیل AI تکمیل نشد",
        impact: "برای تشخیص اثر، تحلیل را دوباره اجرا کنید",
        failureReason,
      },
    })
    await audit({ actorId: adminId, action: "ops.error.diagnose_failed", entity: "ErrorEvent", entityId: event.id, meta: { diagnosisId: failed.id } })
    return failed
  }
}

export async function approveErrorDiagnosis(diagnosisId: string, ownerId: string) {
  const diagnosis = await prisma.errorDiagnosis.update({
    where: { id: diagnosisId },
    data: { approvedById: ownerId, approvedAt: new Date() },
  })
  await audit({ actorId: ownerId, action: "ops.error.diagnosis_approved", entity: "ErrorDiagnosis", entityId: diagnosis.id, meta: { execution: "not_performed" } })
  return diagnosis
}
