import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { listUserDomainOrders, listUserOwnedDomains, submitDomainNameservers } from "@/lib/core/domains/service"

const nameserver = z.string().trim().toLowerCase().min(3).max(253).regex(/^(?=.{1,253}\.?$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\.?$/, "آدرس NS معتبر نیست.").transform((value) => value.replace(/\.$/, ""))
const submitSchema = z.object({
  orderId: z.string().min(1),
  ns1: nameserver,
  ns2: nameserver,
  ns3: z.union([nameserver, z.literal("")]).optional(),
  ns4: z.union([nameserver, z.literal("")]).optional(),
}).refine((data) => new Set([data.ns1, data.ns2, data.ns3, data.ns4].filter(Boolean)).size === [data.ns1, data.ns2, data.ns3, data.ns4].filter(Boolean).length, { message: "NSها نباید تکراری باشند." })

export const GET = route(async () => {
  const user = await requireUser()
  const [orders, domains] = await Promise.all([listUserDomainOrders(user.id), listUserOwnedDomains(user.id)])
  return { orders, domains }
})

export const POST = route(async (req: Request) => {
  const user = await requireUser()
  const body = submitSchema.parse(await req.json())
  return submitDomainNameservers(user.id, body.orderId, [body.ns1, body.ns2, body.ns3 || undefined, body.ns4 || undefined])
})
