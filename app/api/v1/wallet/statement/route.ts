import { WalletTxType } from "@prisma/client"
import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { queryStatement } from "@/lib/core/statement"
import { BASE_CURRENCY } from "@/lib/core/ledger"

export const dynamic = "force-dynamic"

const querySchema = z.object({
  currency: z.string().trim().min(1).max(16).default(BASE_CURRENCY),
  type: z.nativeEnum(WalletTxType).optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  q: z.string().trim().max(200).optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).max(100_000).default(0),
}).refine((value) => !value.from || !value.to || value.from <= value.to, {
  message: "بازه زمانی نامعتبر است.",
  path: ["to"],
})

export const GET = route(async (req: Request) => {
  const user = await requireUser()
  const query = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams))
  const { rows, total, take } = await queryStatement({
    userId: user.id,
    currency: query.currency,
    type: query.type,
    from: query.from,
    to: query.to,
    q: query.q || undefined,
    take: query.take,
    skip: query.skip,
  })
  return { transactions: rows, total, take }
})
