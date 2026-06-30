import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { prisma } from "@/lib/db"
import { createDepositRequest } from "@/lib/core/finance"
import { rateLimitBy } from "@/lib/api/rate-limit"
import { withIdempotency, idempotencyKey, readIdempotencyHeader } from "@/lib/api/idempotency"

export const dynamic = "force-dynamic"

const schema = z.object({
  amount: z.union([z.string(), z.number()]),
  method: z.enum(["CARD", "TON", "USDT"]).optional(),
  cardLast4: z.string().optional(),
  reference: z.string().optional(),
  note: z.string().optional(),
  receiptUrl: z.string().url().optional(),
})

export const GET = route(async () => {
  const user = await requireUser()
  return prisma.depositRequest.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
})

export const POST = route(async (req: Request) => {
  const user = await requireUser()
  const header = readIdempotencyHeader(req)
  const body = schema.parse(await req.json())
  // Limit deposit-request creation and dedupe retries so a single card transfer
  // does not register multiple pending requests.
  await rateLimitBy(user.id, { bucket: "wallet:deposit", limit: 20, windowSec: 3600 })
  return withIdempotency(
    { key: idempotencyKey({ userId: user.id, operation: "wallet:deposit", header, payload: body }) },
    () =>
      createDepositRequest({
        userId: user.id,
        amount: BigInt(body.amount),
        method: body.method,
        cardLast4: body.cardLast4,
        reference: body.reference,
        note: body.note,
        receiptUrl: body.receiptUrl,
      }),
  )
})
