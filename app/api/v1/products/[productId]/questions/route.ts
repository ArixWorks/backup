import { randomBytes } from "node:crypto"
import { cookies } from "next/headers"
import { route } from "@/lib/api/handler"
import { rateLimitBy, rateLimitByIp } from "@/lib/api/rate-limit"
import { getCurrentUser } from "@/lib/auth/session"
import { answerProductQuestion } from "@/lib/ai/product-qa"
import { createQuestion, listPublicQuestions, visitorHash } from "@/lib/core/product-qa"

export const dynamic = "force-dynamic"
const VISITOR_COOKIE = "subio_qa_visitor"
const VISITOR_MAX_AGE = 60 * 60 * 24 * 365

async function visitorToken(create = false) {
  const store = await cookies()
  const current = store.get(VISITOR_COOKIE)?.value
  if (current || !create) return current ?? null
  const token = randomBytes(32).toString("base64url")
  store.set(VISITOR_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: VISITOR_MAX_AGE,
  })
  return token
}

export const GET = route(async (_req: Request, context: { params: Promise<{ productId: string }> }) => {
  const { productId } = await context.params
  return listPublicQuestions(productId, (await visitorToken()) ?? undefined)
})

export const POST = route(async (req: Request, context: { params: Promise<{ productId: string }> }) => {
  const { productId } = await context.params
  await rateLimitByIp(req, {
    bucket: "product-qa:create:ip",
    limit: 8,
    windowSec: 60 * 60,
    message: "تعداد پرسش‌های شما بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.",
  })
  const token = (await visitorToken(true))!
  await rateLimitBy(visitorHash(token), {
    bucket: "product-qa:create:visitor",
    limit: 5,
    windowSec: 60 * 60,
    message: "تعداد پرسش‌های شما بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.",
  })
  const user = await getCurrentUser()
  const payload = await req.json()
  const question = await createQuestion({
    productId,
    body: payload?.body,
    visitorToken: token,
    user: user ? { id: user.id, alias: user.alias } : null,
  })
  const result = await answerProductQuestion(question.id)
  return { questionId: question.id, status: result.status }
})
