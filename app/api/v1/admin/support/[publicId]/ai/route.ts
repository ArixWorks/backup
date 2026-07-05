import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAiAdmin } from "@/lib/ai/permissions"
import { getTicketAdmin } from "@/lib/core/support"
import { draftTicketReply, summarizeTicket, type ThreadMessage } from "@/lib/ai/support"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ publicId: string }> }

// AI assist for the ticket desk. `task` selects draft vs summarize. The thread
// is loaded server-side (never trusted from the client) via getTicketAdmin.
const schema = z.discriminatedUnion("task", [
  z.object({
    task: z.literal("draft"),
    tone: z.string().optional(),
    instruction: z.string().optional(),
  }),
  z.object({ task: z.literal("summarize") }),
])

export const POST = route(async (req: Request, ctx: Ctx) => {
  const admin = await requireAiAdmin()
  const { publicId } = await ctx.params
  const body = schema.parse(await req.json())

  const ticket = await getTicketAdmin(publicId)
  const messages: ThreadMessage[] = ticket.messages.map((m) => ({
    fromStaff: m.fromStaff,
    body: m.body,
  }))
  const actor = { userId: admin.id }

  if (body.task === "draft") {
    return draftTicketReply(
      { subject: ticket.subject, category: ticket.category, messages, tone: body.tone, instruction: body.instruction },
      actor,
    )
  }
  return summarizeTicket({ subject: ticket.subject, messages }, actor)
})
