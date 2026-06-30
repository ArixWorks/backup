import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { prisma } from "@/lib/db"
import { createDepositRequest } from "@/lib/core/finance"
import { createInvoiceLink, botConfigured } from "@/lib/telegram/api"
import { ValidationError } from "@/lib/core/errors"
import { rateLimitBy } from "@/lib/api/rate-limit"
import { formatToman } from "@/lib/format"

export const dynamic = "force-dynamic"

const schema = z.object({
  amount: z.union([z.string(), z.number()]),
})

/**
 * Create a Telegram Stars top-up: build a STARS deposit request, attach a
 * unique invoice payload, and return an invoice link the Mini App opens with
 * `WebApp.openInvoice(url)`. Credit happens later via the webhook.
 */
export const POST = route(async (req: Request) => {
  const user = await requireUser()
  if (!botConfigured()) throw new ValidationError("پرداخت با استارز در دسترس نیست")
  const body = schema.parse(await req.json())
  await rateLimitBy(user.id, { bucket: "wallet:deposit:stars", limit: 20, windowSec: 3600 })

  const dep = await createDepositRequest({
    userId: user.id,
    amount: BigInt(body.amount),
    method: "STARS",
  })

  // Use the request's public id as the idempotent invoice payload.
  const payload = dep.publicId
  await prisma.depositRequest.update({ where: { id: dep.id }, data: { starsPayload: payload } })

  const stars = Number(dep.payAmount)
  const url = await createInvoiceLink({
    title: "شارژ کیف پول",
    description: `افزایش موجودی به میزان ${formatToman(dep.amount)} تومان`,
    payload,
    stars,
  })

  return { id: dep.id, publicId: dep.publicId, stars, invoiceUrl: url }
})
