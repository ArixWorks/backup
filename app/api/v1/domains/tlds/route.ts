import { route } from "@/lib/api/handler"
import { listTlds } from "@/lib/core/domains/service"

export const GET = route(async () => ({ tlds: await listTlds() }))
