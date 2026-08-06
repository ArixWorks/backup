import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { lookupDomainsBatch } from "@/lib/core/domains/service"

// TEMPORARY QA-ONLY PROBE - delete before committing.
// Calls the suggestion loop's own internals directly so the test does not depend
// on a Secure session cookie surviving a plain-http localhost request.
export const maxDuration = 120

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "nope" }, { status: 404 })
  const email = process.env.QA_USER_EMAIL
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null
  if (!user) return NextResponse.json({ error: "qa user missing" }, { status: 404 })

  const url = new URL(req.url)
  const domains = (url.searchParams.get("domains") ?? "").split(",").filter(Boolean)
  if (domains.length) {
    const results = await lookupDomainsBatch(domains)
    return NextResponse.json({
      batch: [...results.values()].map((r) => ({ d: r.asciiDomain, s: r.status, cached: r.cached })),
    })
  }
  return NextResponse.json({ ok: true, userId: user.id })
}
