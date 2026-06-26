import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { prisma } from "@/lib/db"
import { convertCurrency } from "@/lib/core/wallet"
import { getRate } from "@/lib/core/currencies"
import { ValidationError } from "@/lib/core/errors"
import { rateLimitBy } from "@/lib/api/rate-limit"
import { withIdempotency, idempotencyKey, readIdempotencyHeader } from "@/lib/api/idempotency"

export const dynamic = "force-dynamic"

const schema = z.object({
  from: z.string().min(2).max(8),
  to: z.string().min(2).max(8),
  amount: z.union([z.string(), z.number()]),
})

/** Convert funds between two of the user's currency wallets at the live rate. */
export const POST = route(async (req: Request) => {
  const user = await requireUser()
  const header = readIdempotencyHeader(req)
  const body = schema.parse(await req.json())
  const fromAmount = BigInt(body.amount)
  if (fromAmount <= 0n) throw new ValidationError("مبلغ باید مثبت باشد")
  if (body.from === body.to) throw new ValidationError("ارز مبدأ و مقصد یکسان است")

  const rate = await getRate(body.from, body.to)
  if (rate == null) throw new ValidationError("نرخ تبدیل برای این جفت‌ارز موجود نیست")

  // Throttle and dedupe so a double-submit can't convert twice.
  await rateLimitBy(user.id, { bucket: "wallet:convert", limit: 20, windowSec: 600 })
  return withIdempotency(
    {
      key: idempotencyKey({
        userId: user.id,
        operation: "wallet:convert",
        header,
        payload: { from: body.from, to: body.to, amount: body.amount },
      }),
    },
    () =>
      prisma.$transaction((tx) =>
        convertCurrency({
          userId: user.id,
          fromCurrency: body.from,
          toCurrency: body.to,
          fromAmount,
          rate,
          db: tx,
        }),
      ),
  )
})
