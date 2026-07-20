import "server-only"
import { z } from "zod"
import type { ModelMessage } from "ai"
import { prisma } from "@/lib/db"
import { runObject } from "@/lib/ai/client"
import { getAllSettings, toBool, toNumber } from "@/lib/core/settings"
import { notifyAdminsProductQuestion } from "@/lib/telegram/notify"

const resultSchema = z.object({
  answerable: z.boolean(),
  answer: z.string().max(1800),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string().min(1).max(240)).max(8),
  reason: z.string().max(500),
})

function jsonValue(value: unknown) {
  return JSON.stringify(value, (_, item) => (typeof item === "bigint" ? item.toString() : item), 2)
}

function safeImageUrls(urls: Array<string | null | undefined>) {
  const safe = urls.flatMap((value) => {
    if (!value) return []
    try {
      const url = new URL(value)
      const host = url.hostname.toLowerCase()
      const privateHost =
        host === "localhost" ||
        host === "0.0.0.0" ||
        host === "::1" ||
        host.endsWith(".local") ||
        /^127\./u.test(host) ||
        /^10\./u.test(host) ||
        /^192\.168\./u.test(host) ||
        /^172\.(1[6-9]|2\d|3[01])\./u.test(host)
      return url.protocol === "https:" && !privateHost ? [url.toString()] : []
    } catch {
      return []
    }
  })
  return Array.from(new Set(safe)).slice(0, 5)
}

export async function buildProductQuestionContext(questionId: string) {
  const question = await prisma.productQuestion.findUnique({
    where: { id: questionId },
    include: {
      product: {
        include: {
          fixedSale: true,
          variants: { where: { active: true }, orderBy: { displayOrder: "asc" } },
          auction: true,
        },
      },
    },
  })
  if (!question) throw new Error("Question not found")
  const p = question.product
  return {
    question,
    images: safeImageUrls([p.coverImage, ...p.gallery]),
    publicContext: {
      title: p.title,
      description: p.description,
      category: p.category,
      tags: p.tags,
      links: p.links,
      saleMode: p.saleMode,
      deliveryType: p.deliveryType,
      fixedSale: p.fixedSale
        ? {
            price: p.fixedSale.price,
            availableStock: Math.max(0, p.fixedSale.stock - p.fixedSale.reservedStock),
            purchaseLimit: p.fixedSale.purchaseLimit,
            bulkMinQty: p.fixedSale.bulkMinQty,
            bulkDiscountPercent: p.fixedSale.bulkDiscountPercent,
            startTime: p.fixedSale.startTime,
            endTime: p.fixedSale.endTime,
          }
        : null,
      variants: p.variants.map((v) => ({
        name: v.name,
        attributes: v.attributes,
        description: v.description,
        price: v.price,
        compareAtPrice: v.compareAtPrice,
        availableStock: Math.max(0, v.stock - v.reservedStock),
        purchaseLimit: v.purchaseLimit,
        deliveryType: v.deliveryType,
      })),
      auction: p.auction
        ? {
            status: p.auction.status,
            startPrice: p.auction.startPrice,
            currentPrice: p.auction.currentPrice,
            minimumIncrement: p.auction.minimumIncrement,
            buyNowPrice: p.auction.buyNowPrice,
            quantity: p.auction.quantity,
            startTime: p.auction.startTime,
            endTime: p.auction.endTime,
          }
        : null,
    },
  }
}

async function escalate(questionId: string, title: string, body: string, reason?: string) {
  const updated = await prisma.productQuestion.updateMany({
    where: { id: questionId, status: "PENDING_AI" },
    data: { status: "PENDING_ADMIN", aiReason: reason?.slice(0, 500), adminNotifiedAt: new Date() },
  })
  if (updated.count > 0) await notifyAdminsProductQuestion(title, body)
}

export async function answerProductQuestion(questionId: string) {
  const { question, publicContext, images } = await buildProductQuestionContext(questionId)
  const settings = await getAllSettings()
  const autoEnabled = toBool(settings["ai.productQa.autoPublish"] ?? "true")
  const threshold = Math.min(0.98, Math.max(0.7, toNumber(settings["ai.productQa.confidenceThreshold"] ?? "0.9", 0.9)))

  const content: Array<{ type: "text"; text: string } | { type: "image"; image: URL }> = [
    {
      type: "text",
      text: `پرسش مشتری:\n${question.body}\n\nداده زنده و مجاز محصول:\n${jsonValue(publicContext)}`,
    },
    ...images.map((image) => ({ type: "image" as const, image: new URL(image) })),
  ]
  const messages: ModelMessage[] = [{ role: "user", content }]

  try {
    const { object, model } = await runObject({
      feature: "product_qa.answer",
      schema: resultSchema,
      messages,
      temperature: 0.1,
      maxTokens: 900,
      userId: question.userId,
      refType: "ProductQuestion",
      refId: question.id,
      timeoutMs: 90000,
      system:
        "تو دستیار دقیق فروشگاه هستی. فقط از داده زنده ارائه‌شده و آنچه مستقیماً در تصاویر همان محصول دیده می‌شود پاسخ فارسی بده. هرگز حدس نزن، اطلاعات داخلی یا شخصی را افشا نکن، وعده یا ضمانت نساز و درباره موضوع خارج از محصول پاسخ نده. evidence باید دقیقاً به فیلد یا مشاهده تصویری اتکا کند. اگر پاسخ صریح در داده نیست answerable=false و answer خالی باشد. قیمت، موجودی و زمان را بدون تغییر معنا گزارش کن.",
      meta: { images: images.length, threshold },
    })

    const safe = object.answerable && object.answer.trim().length >= 3 && object.evidence.length > 0 && object.confidence >= threshold
    await prisma.$transaction(async (tx) => {
      await tx.productQuestion.update({
        where: { id: questionId },
        data: {
          aiAttemptedAt: new Date(),
          aiAnswerable: object.answerable,
          aiConfidence: object.confidence,
          aiReason: object.reason,
          aiEvidence: object.evidence,
          aiModel: model,
        },
      })
      if (autoEnabled && safe) {
        const claimed = await tx.productQuestion.updateMany({
          where: { id: questionId, status: "PENDING_AI" },
          data: { status: "ANSWERED", answeredAt: new Date() },
        })
        if (claimed.count === 1) {
          await tx.productAnswer.create({
            data: {
              questionId,
              source: "AI",
              body: object.answer.trim(),
              published: true,
              publishedAt: new Date(),
              model,
              confidence: object.confidence,
              evidence: object.evidence,
            },
          })
        }
      }
    })

    if (!autoEnabled || !safe) await escalate(questionId, publicContext.title, question.body, object.reason)
    const current = await prisma.productQuestion.findUnique({ where: { id: questionId }, select: { status: true } })
    return { status: current?.status ?? "PENDING_ADMIN" }
  } catch (error) {
    await escalate(questionId, publicContext.title, question.body, error instanceof Error ? error.message : "AI failed")
    return { status: "PENDING_ADMIN" as const }
  }
}
