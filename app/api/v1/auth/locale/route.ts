import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth/session"
import { LOCALES } from "@/lib/i18n/locales"

export const dynamic = "force-dynamic"

const schema = z.object({ locale: z.enum(LOCALES) })

/** Persist the user's manual language choice so it sticks across sessions. */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Not signed in" } },
      { status: 401 },
    )
  }
  const { locale } = schema.parse(await req.json())
  await prisma.user.update({
    where: { id: user.id },
    data: { languageCode: locale, localeManual: true },
  })
  return NextResponse.json({ ok: true, data: { locale } })
}
