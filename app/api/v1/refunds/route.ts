import { z } from "zod"
import { uploadedFileUrl } from "@/lib/api/file-url"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { createRefundRequest, listRefunds } from "@/lib/core/refunds"

export const dynamic = "force-dynamic"

const schema = z.object({
  amount: z.union([z.string(), z.number()]),
  fullName: z.string(),
  nationalId: z.string(),
  nationalCardUrl: uploadedFileUrl,
  cardNumber: z.string(),
  iban: z.string().optional(),
  reason: z.string().optional(),
})

export const GET = route(async () => {
  const user = await requireUser()
  return listRefunds(user.id)
})

export const POST = route(async (req: Request) => {
  const user = await requireUser()
  const body = schema.parse(await req.json())
  return createRefundRequest({
    userId: user.id,
    amount: BigInt(body.amount),
    fullName: body.fullName,
    nationalId: body.nationalId,
    nationalCardUrl: body.nationalCardUrl,
    cardNumber: body.cardNumber,
    iban: body.iban,
    reason: body.reason,
  })
})
