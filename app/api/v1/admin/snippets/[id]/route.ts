import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { NotFoundError } from "@/lib/core/errors"
import { prisma } from "@/lib/db"
import { sanitizeRichHtml } from "@/lib/rich-content/sanitize"

export const dynamic = "force-dynamic"

export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin()
  const { id } = await ctx.params
  const body = (await req.json()) as { name?: string; category?: string | null; html?: string }
  const existing = await prisma.contentSnippet.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError("اسنیپت یافت نشد")
  const snippet = await prisma.contentSnippet.update({
    where: { id },
    data: {
      name: body.name?.trim() ?? undefined,
      category: body.category === undefined ? undefined : body.category?.trim() || null,
      html: body.html === undefined ? undefined : sanitizeRichHtml(body.html),
    },
  })
  return snippet
})

export const DELETE = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin()
  const { id } = await ctx.params
  const existing = await prisma.contentSnippet.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError("اسنیپت یافت نشد")
  await prisma.contentSnippet.delete({ where: { id } })
  return { deleted: true }
})
