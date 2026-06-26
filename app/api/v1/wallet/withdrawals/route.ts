import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { prisma } from "@/lib/db"
import { createWithdrawalRequest } from "@/lib/core/finance"
import { rateLimitBy } from "@/lib/api/rate-limit"
import { withIdempotency, idempotencyKey, readIdempotencyHeader } from "@/lib/api/idempotency"

export const dynamic = "force-dynamic"

const schema = z.object({
  amount: z.union([z.string(), z.number()]),
  iban: z.string().optional(),
  cardNumber: z.string().optional(),
  note: z.string().optional(),
})

export const GET = route(async () => {
  const user = await requireUser()
  return prisma.withdrawalRequest.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
})

export const POST = route(async (req: Request) => {
  const user = await requireUser()
  const header = readIdempotencyHeader(req)
  const body = schema.parse(await req.json())
  // Tight cap on payout requests, plus idempotency so a resend cannot create
  // two withdrawals that both debit the wallet.
  await rateLimitBy(user.id, { bucket: "wallet:withdraw", limit: 10, windowSec: 3600 })
  return withIdempotency(
    { key: idempotencyKey({ userId: user.id, operation: "wallet:withdraw", header, payload: body }) },
    () =>
      createWithdrawalRequest({
        userId: user.id,
        amount: BigInt(body.amount),
        iban: body.iban,
        cardNumber: body.cardNumber,
        note: body.note,
      }),
  )
})
