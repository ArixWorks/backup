import "server-only"

import { createHash } from "node:crypto"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/core/audit"
import { DomainError } from "@/lib/core/errors"
import { runObject } from "@/lib/ai/client"
import sourceManifest from "./source-manifest.json"

const CORRUPTION = /\uFFFD|(?:Ã.|Â.|Ø.|Ù.)|[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u
const PERSIAN = /[\u0600-\u06FF]/u
const repairSchema = z.object({
  repairable: z.boolean(),
  proposedText: z.string(),
  confidence: z.number().min(0).max(1),
  explanation: z.string().max(500),
})

export type TextCandidate = {
  entity: "Product" | "ProductVariant" | "Content" | "ContentSnippet" | "ContentCategory" | "ContentTag"
  recordId: string
  field: string
  text: string
  context?: string
}

export function detectCorruption(text: string) {
  const markers = Array.from(new Set(text.match(/\uFFFD|Ã.|Â.|Ø.|Ù.|[\u0000-\u0008\u000B\u000C\u000E-\u001F]/gu) ?? []))
  return { suspicious: PERSIAN.test(text) && CORRUPTION.test(text), markers }
}

function checksum(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function fingerprint(input: Pick<TextCandidate, "entity" | "recordId" | "field"> & { checksum: string }) {
  return checksum(`${input.entity}:${input.recordId}:${input.field}:${input.checksum}`)
}

function placeholders(text: string) {
  return [...text.matchAll(/\{[^{}]+\}|https?:\/\/\S+|<[^>]+>/g)].map((m) => m[0]).sort()
}

function validRepair(original: string, proposed: string) {
  if (!proposed.trim() || CORRUPTION.test(proposed)) return false
  if (JSON.stringify(placeholders(original)) !== JSON.stringify(placeholders(proposed))) return false
  return proposed.length >= original.length * 0.5 && proposed.length <= original.length * 1.8
}

async function candidates(limit: number): Promise<TextCandidate[]> {
  const per = Math.max(5, Math.floor(limit / 6))
  const [products, variants, contents, snippets, categories, tags] = await Promise.all([
    prisma.product.findMany({ take: per, orderBy: { updatedAt: "desc" }, select: { id: true, title: true, description: true } }),
    prisma.productVariant.findMany({ take: per, orderBy: { updatedAt: "desc" }, select: { id: true, name: true, description: true } }),
    prisma.content.findMany({ where: { locale: { startsWith: "fa" } }, take: per, orderBy: { updatedAt: "desc" }, select: { id: true, title: true, excerpt: true, body: true, seoTitle: true, seoDescription: true, navLabel: true, breadcrumbLabel: true } }),
    prisma.contentSnippet.findMany({ take: per, orderBy: { updatedAt: "desc" }, select: { id: true, name: true, html: true } }),
    prisma.contentCategory.findMany({ take: per, orderBy: { updatedAt: "desc" }, select: { id: true, name: true } }),
    prisma.contentTag.findMany({ take: per, orderBy: { createdAt: "desc" }, select: { id: true, name: true } }),
  ])
  const out: TextCandidate[] = []
  const add = (entity: TextCandidate["entity"], recordId: string, fields: Record<string, string | null>) => {
    for (const [field, text] of Object.entries(fields)) if (text) out.push({ entity, recordId, field, text })
  }
  products.forEach((r) => add("Product", r.id, { title: r.title, description: r.description }))
  variants.forEach((r) => add("ProductVariant", r.id, { name: r.name, description: r.description }))
  contents.forEach((r) => add("Content", r.id, r))
  snippets.forEach((r) => add("ContentSnippet", r.id, { name: r.name, html: r.html }))
  categories.forEach((r) => add("ContentCategory", r.id, { name: r.name }))
  tags.forEach((r) => add("ContentTag", r.id, { name: r.name }))
  return out.slice(0, limit)
}

export async function runTextIntegrityScan(limit = 180) {
  const run = await prisma.textIntegrityScanRun.create({ data: {} })
  let scannedCount = 0
  let suspiciousCount = 0
  let newFindings = 0
  let aiCalls = 0
  try {
    for (const item of await candidates(limit)) {
      scannedCount++
      const detected = detectCorruption(item.text)
      if (!detected.suspicious) continue
      suspiciousCount++
      const sourceChecksum = checksum(item.text)
      const id = fingerprint({ ...item, checksum: sourceChecksum })
      const existing = await prisma.textIntegrityFinding.findUnique({ where: { fingerprint: id } })
      if (existing) {
        await prisma.textIntegrityFinding.update({ where: { id: existing.id }, data: { lastSeenAt: new Date() } })
        continue
      }
      aiCalls++
      const { object } = await runObject({
        feature: "text_integrity.repair",
        tier: "fast",
        schema: repairSchema,
        system: "متن فارسی دارای خرابی encoding است. فقط نویسه‌های خراب را از روی بافت بازسازی کن. معنا، HTML، لینک‌ها، اعداد و placeholderهای داخل آکولاد را دقیقاً حفظ کن. اگر مطمئن نیستی repairable=false بده.",
        prompt: `موجودیت: ${item.entity}.${item.field}\nمتن:\n${item.text}`,
        refType: item.entity,
        refId: item.recordId,
        timeoutMs: 60000,
      })
      const proposedText = object.repairable && validRepair(item.text, object.proposedText) ? object.proposedText : null
      await prisma.textIntegrityFinding.create({
        data: {
          source: "DATABASE",
          entity: item.entity,
          recordId: item.recordId,
          field: item.field,
          originalText: item.text,
          proposedText,
          markers: detected.markers,
          confidence: object.confidence,
          explanation: object.explanation,
          fingerprint: id,
          sourceChecksum,
        },
      })
      newFindings++
    }
    for (const source of sourceManifest as { path: string; line: number; text: string }[]) {
      scannedCount++
      const detected = detectCorruption(source.text)
      if (!detected.suspicious) continue
      suspiciousCount++
      const sourceChecksum = checksum(source.text)
      const id = checksum(`SOURCE_CODE:${source.path}:${source.line}:${sourceChecksum}`)
      const existing = await prisma.textIntegrityFinding.findUnique({ where: { fingerprint: id } })
      if (existing) {
        await prisma.textIntegrityFinding.update({ where: { id: existing.id }, data: { lastSeenAt: new Date() } })
        continue
      }
      aiCalls++
      const { object } = await runObject({
        feature: "text_integrity.source_report",
        tier: "fast",
        schema: repairSchema,
        system: "این خط کد شامل متن فارسی با نویسه خراب است. فقط متن فارسی را بازسازی کن و ساختار کد، نقل‌قول‌ها و placeholderها را حفظ کن. خروجی فقط یک پیشنهاد است و هرگز خودکار اعمال نمی‌شود.",
        prompt: `فایل: ${source.path}:${source.line}\nخط:\n${source.text}`,
        timeoutMs: 60000,
      })
      const proposedText = object.repairable && validRepair(source.text, object.proposedText) ? object.proposedText : null
      await prisma.textIntegrityFinding.create({
        data: {
          source: "SOURCE_CODE",
          entity: "SourceCode",
          field: "line",
          sourcePath: source.path,
          sourceLine: source.line,
          originalText: source.text,
          proposedText,
          markers: detected.markers,
          confidence: object.confidence,
          explanation: object.explanation,
          fingerprint: id,
          sourceChecksum,
        },
      })
      newFindings++
    }
    await prisma.textIntegrityScanRun.update({ where: { id: run.id }, data: { status: "COMPLETED", scannedCount, suspiciousCount, newFindings, aiCalls, completedAt: new Date() } })
    return { runId: run.id, scannedCount, suspiciousCount, newFindings, aiCalls }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await prisma.textIntegrityScanRun.update({ where: { id: run.id }, data: { status: "FAILED", scannedCount, suspiciousCount, newFindings, aiCalls, error: message.slice(0, 500), completedAt: new Date() } })
    throw error
  }
}

async function currentValue(entity: string, recordId: string, field: string): Promise<string | null> {
  const select = { [field]: true }
  switch (entity) {
    case "Product": return String((await prisma.product.findUnique({ where: { id: recordId }, select }))?.[field as "title"] ?? "")
    case "ProductVariant": return String((await prisma.productVariant.findUnique({ where: { id: recordId }, select }))?.[field as "name"] ?? "")
    case "Content": return String((await prisma.content.findUnique({ where: { id: recordId }, select }))?.[field as "title"] ?? "")
    case "ContentSnippet": return String((await prisma.contentSnippet.findUnique({ where: { id: recordId }, select }))?.[field as "name"] ?? "")
    case "ContentCategory": return String((await prisma.contentCategory.findUnique({ where: { id: recordId }, select }))?.[field as "name"] ?? "")
    case "ContentTag": return String((await prisma.contentTag.findUnique({ where: { id: recordId }, select }))?.[field as "name"] ?? "")
    default: return null
  }
}

async function updateValue(entity: string, recordId: string, field: string, value: string) {
  const data = { [field]: value }
  switch (entity) {
    case "Product": return prisma.product.update({ where: { id: recordId }, data })
    case "ProductVariant": return prisma.productVariant.update({ where: { id: recordId }, data })
    case "Content": return prisma.content.update({ where: { id: recordId }, data })
    case "ContentSnippet": return prisma.contentSnippet.update({ where: { id: recordId }, data })
    case "ContentCategory": return prisma.contentCategory.update({ where: { id: recordId }, data })
    case "ContentTag": return prisma.contentTag.update({ where: { id: recordId }, data })
    default: throw new DomainError("منبع این پیشنهاد قابل تغییر نیست.", "UNSUPPORTED_SOURCE", 422)
  }
}

export async function reviewFinding(id: string, decision: "approve" | "reject", adminId: string) {
  const finding = await prisma.textIntegrityFinding.findUnique({ where: { id } })
  if (!finding || finding.status !== "PENDING") throw new DomainError("پیشنهاد در انتظار یافت نشد.", "NOT_FOUND", 404)
  if (decision === "reject") {
    await prisma.textIntegrityFinding.update({ where: { id }, data: { status: "REJECTED", reviewedAt: new Date(), reviewedById: adminId } })
    await audit({ actorId: adminId, action: "text_integrity.reject", entity: "TextIntegrityFinding", entityId: id })
    return { status: "REJECTED" }
  }
  if (finding.source !== "DATABASE" || !finding.recordId || !finding.proposedText) throw new DomainError("این پیشنهاد قابل اعمال نیست.", "NOT_APPLICABLE", 422)
  const current = await currentValue(finding.entity, finding.recordId, finding.field)
  if (current === null || checksum(current) !== finding.sourceChecksum) {
    await prisma.textIntegrityFinding.update({ where: { id }, data: { status: "STALE", reviewedAt: new Date(), reviewedById: adminId } })
    throw new DomainError("متن پس از اسکن تغییر کرده و پیشنهاد منقضی شد.", "STALE", 409)
  }
  await updateValue(finding.entity, finding.recordId, finding.field, finding.proposedText)
  await prisma.textIntegrityFinding.update({ where: { id }, data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: adminId, appliedAt: new Date() } })
  await audit({ actorId: adminId, action: "text_integrity.approve", entity: finding.entity, entityId: finding.recordId, meta: { field: finding.field, before: finding.originalText, after: finding.proposedText } })
  return { status: "APPROVED" }
}

export async function listTextIntegrityFindings(status?: "PENDING" | "APPROVED" | "REJECTED" | "STALE") {
  const [findings, latestRun, pending] = await Promise.all([
    prisma.textIntegrityFinding.findMany({ where: status ? { status } : undefined, orderBy: { lastSeenAt: "desc" }, take: 100 }),
    prisma.textIntegrityScanRun.findFirst({ orderBy: { createdAt: "desc" } }),
    prisma.textIntegrityFinding.count({ where: { status: "PENDING" } }),
  ])
  return { findings, latestRun, pending }
}
