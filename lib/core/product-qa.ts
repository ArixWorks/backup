import "server-only"
import { createHash } from "node:crypto"
import { z } from "zod"
import type { Prisma, ProductQuestionStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { audit } from "@/lib/core/audit"
import { ConflictError, NotFoundError, ValidationError } from "@/lib/core/errors"
import { createNotification } from "@/lib/core/notifications"

const URL_OR_CONTACT = /(?:https?:\/\/|www\.|t\.me\/|@[a-z0-9_]{4,}|\b\d{8,}\b)/iu
const REPEATED = /(.)\1{7,}/u

export const questionInputSchema = z.object({
  body: z.string().trim().min(8, "پرسش باید حداقل ۸ نویسه باشد.").max(600, "پرسش حداکثر ۶۰۰ نویسه است."),
})

export const adminAnswerSchema = z.object({
  action: z.enum(["publish", "reject", "hide"]),
  body: z.string().trim().max(2000).optional(),
})

export function normalizeQuestion(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u200b\u200c\u200d\ufeff]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
}

export function questionHash(value: string) {
  return createHash("sha256").update(normalizeQuestion(value).toLocaleLowerCase("fa")).digest("hex")
}

export function visitorHash(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function guestAlias(token: string) {
  const code = createHash("sha256").update(`alias:${token}`).digest("hex").slice(0, 6).toUpperCase()
  return `مهمان-${code}`
}

function validateQuestion(body: string) {
  const normalized = normalizeQuestion(body)
  if (URL_OR_CONTACT.test(normalized)) throw new ValidationError("در متن پرسش لینک یا اطلاعات تماس وارد نکنید.")
  if (REPEATED.test(normalized)) throw new ValidationError("متن پرسش معتبر نیست.")
  return questionInputSchema.parse({ body: normalized }).body
}

export async function listPublicQuestions(productId: string, visitor?: string) {
  const hash = visitor ? visitorHash(visitor) : null
  const items = await prisma.productQuestion.findMany({
    where: {
      productId,
      OR: [
        { status: "ANSWERED", answers: { some: { published: true } } },
        ...(hash ? [{ visitorHash: hash, status: { in: ["PENDING_AI", "PENDING_ADMIN"] as ProductQuestionStatus[] } }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      body: true,
      publicAlias: true,
      status: true,
      createdAt: true,
      answers: {
        where: { published: true },
        orderBy: { publishedAt: "desc" },
        take: 1,
        select: { id: true, body: true, source: true, publishedAt: true },
      },
    },
  })
  return { items }
}

export async function createQuestion(input: {
  productId: string
  body: string
  visitorToken: string
  user?: { id: string; alias: string } | null
}) {
  const body = validateQuestion(input.body)
  const normalizedBodyHash = questionHash(body)
  const hash = visitorHash(input.visitorToken)
  const product = await prisma.product.findFirst({
    where: { id: input.productId, active: true, hidden: false },
    select: { id: true },
  })
  if (!product) throw new NotFoundError("محصول یافت نشد.")

  const duplicate = await prisma.productQuestion.findFirst({
    where: {
      productId: input.productId,
      normalizedBodyHash,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      status: { notIn: ["REJECTED", "HIDDEN"] },
    },
    select: { id: true },
  })
  if (duplicate) throw new ConflictError("این پرسش اخیراً ثبت شده است.")

  return prisma.productQuestion.create({
    data: {
      productId: input.productId,
      body,
      normalizedBodyHash,
      visitorHash: hash,
      publicAlias: input.user?.alias || guestAlias(input.visitorToken),
      userId: input.user?.id ?? null,
    },
    select: { id: true, status: true, createdAt: true },
  })
}

export async function countQuestionsNeedingReview() {
  return prisma.productQuestion.count({ where: { status: "PENDING_ADMIN" } })
}

export async function listQuestionsAdmin(status?: ProductQuestionStatus, search?: string) {
  const where: Prisma.ProductQuestionWhereInput = {
    ...(status ? { status } : {}),
    ...(search
      ? { OR: [{ body: { contains: search, mode: "insensitive" } }, { product: { title: { contains: search, mode: "insensitive" } } }] }
      : {}),
  }
  const [items, pending] = await Promise.all([
    prisma.productQuestion.findMany({
      where,
      orderBy: status === "PENDING_ADMIN" ? { createdAt: "asc" } : { createdAt: "desc" },
      take: 100,
      include: {
        product: {
          select: {
            id: true,
            title: true,
            saleMode: true,
            coverImage: true,
            gallery: true,
            description: true,
            auction: { select: { id: true } },
          },
        },
        answers: { orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.productQuestion.count({ where: { status: "PENDING_ADMIN" } }),
  ])
  return { items, pending }
}

export async function moderateQuestion(questionId: string, input: z.infer<typeof adminAnswerSchema>, adminId: string) {
  const parsed = adminAnswerSchema.parse(input)
  const question = await prisma.productQuestion.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      userId: true,
      productId: true,
      product: { select: { saleMode: true, auction: { select: { id: true } } } },
    },
  })
  if (!question) throw new NotFoundError("پرسش یافت نشد.")

  if (parsed.action === "publish") {
    const body = parsed.body?.trim()
    if (!body || body.length < 3) throw new ValidationError("متن پاسخ الزامی است.")
    await prisma.$transaction(async (tx) => {
      await tx.productAnswer.updateMany({ where: { questionId, published: true }, data: { published: false } })
      await tx.productAnswer.create({ data: { questionId, source: "ADMIN", body, published: true, adminId, publishedAt: new Date() } })
      await tx.productQuestion.update({ where: { id: questionId }, data: { status: "ANSWERED", answeredAt: new Date() } })
      await audit({ actorId: adminId, action: "product_qa.publish", entity: "ProductQuestion", entityId: questionId }, tx)
    })
    if (question.userId) {
      const href =
        question.product.saleMode === "AUCTION" && question.product.auction
          ? `/auctions/${question.product.auction.id}`
          : `/flash/${question.productId}`
      await createNotification({
        userId: question.userId,
        title: "پاسخ پرسش شما آماده است",
        body: body.slice(0, 180),
        href,
      }).catch(() => {})
    }
    return { status: "ANSWERED" as const }
  }

  const status = parsed.action === "reject" ? "REJECTED" : "HIDDEN"
  await prisma.$transaction(async (tx) => {
    await tx.productAnswer.updateMany({ where: { questionId, published: true }, data: { published: false } })
    await tx.productQuestion.update({ where: { id: questionId }, data: { status } })
    await audit({ actorId: adminId, action: `product_qa.${parsed.action}`, entity: "ProductQuestion", entityId: questionId }, tx)
  })
  return { status }
}
