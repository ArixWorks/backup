import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export const GET = route(async () => {
  await requireAdmin()
  return prisma.content.findMany({
    where: { type: "tutorial", status: "PUBLISHED" },
    orderBy: [{ order: "asc" }, { updatedAt: "desc" }],
    select: { id: true, title: true, slug: true },
    take: 200,
  })
})
