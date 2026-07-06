import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { ValidationError } from "@/lib/core/errors"
import { prisma } from "@/lib/db"
import { sanitizeRichHtml } from "@/lib/rich-content/sanitize"

export const dynamic = "force-dynamic"

/** List reusable content snippets, optionally filtered by search/category. */
export const GET = route(async (req: Request) => {
  await requireAdmin()
  const url = new URL(req.url)
  const q = url.searchParams.get("q")?.trim()
  const category = url.searchParams.get("category")?.trim()
  const items = await prisma.contentSnippet.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  })
  return { items }
})

/** Save a new reusable snippet. Body HTML is sanitized to canonical form. */
export const POST = route(async (req: Request) => {
  const admin = await requireAdmin()
  const body = (await req.json()) as { name?: string; category?: string; html?: string }
  if (!body.name?.trim()) throw new ValidationError("نام اسنیپت الزامی است")
  if (!body.html?.trim()) throw new ValidationError("محتوای اسنیپت خالی است")
  const snippet = await prisma.contentSnippet.create({
    data: {
      name: body.name.trim(),
      category: body.category?.trim() || null,
      html: sanitizeRichHtml(body.html),
      createdById: admin.id,
    },
  })
  return snippet
})
