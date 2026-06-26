import { route } from "@/lib/api/handler"
import { listAuctions } from "@/lib/core/catalog"

export const dynamic = "force-dynamic"

export const GET = route(async () => {
  return listAuctions()
})
