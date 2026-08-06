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
  const prompt = url.searchParams.get("prompt")
  if (prompt) {
    const { generateVerifiedSuggestions } = await import("@/lib/core/domains/suggestion-loop")
    const started = Date.now()
    const result = await generateVerifiedSuggestions({ prompt, userId: user.id })
    return NextResponse.json({
      ms: Date.now() - started,
      rounds: result.rounds,
      availableCount: result.availableCount,
      exhausted: result.exhausted,
      cards: result.suggestions.map((s) => `${s.status} ${s.domain}`),
    })
  }

  const domains = (url.searchParams.get("domains") ?? "").split(",").filter(Boolean)
  if (domains.length) {
    const results = await lookupDomainsBatch(domains)
    return NextResponse.json({
      batch: [...results.values()].map((r) => ({ d: r.asciiDomain, s: r.status, cached: r.cached })),
    })
  }
  const { createSession } = await import("@/lib/auth/session")
  await createSession(user.id)
  return NextResponse.json({ ok: true, userId: user.id })
}
