import "server-only"
import { z } from "zod"
import { runObject } from "./client"
import { searchKnowledge } from "./knowledge"

/**
 * AI Support — assists staff on the ticket desk. Every function routes through
 * the shared AI core (`runObject`) with `support.*` feature tags for analytics
 * and rate scoping. Nothing here is provider-specific.
 *
 * These helpers are ADVISORY: they draft/summarize for a human agent and never
 * auto-send a reply to a customer.
 */

export interface ThreadMessage {
  fromStaff: boolean
  body: string
}

const SUPPORT_SYSTEM =
  "تو دستیار تیم پشتیبانی فروشگاه دیجیتال فارسی‌زبان SubIO هستی. " +
  "لحن محترمانه، دقیق و راه‌حل‌محور داشته باش. " +
  "هرگز وعده بازپرداخت، تخفیف یا زمان دقیق تحویل نده مگر اینکه در گفتگو صراحتاً آمده باشد. " +
  "اگر اطلاعات کافی نیست، سؤال روشن‌کننده بپرس. همیشه فارسی پاسخ بده."

function renderThread(subject: string, messages: ThreadMessage[]) {
  const lines = messages.map((m) => `${m.fromStaff ? "پشتیبانی" : "کاربر"}: ${m.body}`)
  return `موضوع تیکت: ${subject}\n\nگفتگو:\n${lines.join("\n")}`
}

// ---------------------------------------------------------------------------
// Draft a suggested staff reply
// ---------------------------------------------------------------------------
export const draftReplySchema = z.object({
  reply: z.string().describe("متن پاسخ پیشنهادی آماده ارسال به کاربر"),
  needsInfo: z.array(z.string()).describe("اطلاعاتی که برای پاسخ کامل لازم است (در صورت وجود)"),
})
export type DraftReply = z.infer<typeof draftReplySchema>

export async function draftTicketReply(
  input: { subject: string; category?: string; messages: ThreadMessage[]; tone?: string; instruction?: string },
  actor: { userId?: string | null },
): Promise<DraftReply> {
  // RAG: pull public knowledge base context relevant to the latest user message.
  const lastUserMsg = [...input.messages].reverse().find((m) => !m.fromStaff)?.body
  let knowledgeBlock = ""
  if (lastUserMsg) {
    try {
      const hits = await searchKnowledge(`${input.subject}\n${lastUserMsg}`, {
        limit: 3,
        publicOnly: true,
        userId: actor.userId,
      })
      if (hits.length > 0) {
        knowledgeBlock =
          "\n\nاطلاعات مرتبط از پایگاه دانش (فقط در صورت مرتبط بودن استفاده کن):\n" +
          hits.map((h, i) => `[${i + 1}] ${h.title}: ${h.content}`).join("\n")
      }
    } catch {
      // KB is best-effort; drafting must still work if retrieval fails.
    }
  }

  const { object } = await runObject({
    feature: "support.draft_reply",
    schema: draftReplySchema,
    system: SUPPORT_SYSTEM,
    userId: actor.userId,
    prompt: [
      "بر اساس گفتگوی زیر، یک پاسخ پیشنهادی برای تیم پشتیبانی بنویس.",
      input.category ? `دسته‌بندی: ${input.category}` : "",
      input.instruction ? `دستور اضافی: ${input.instruction}` : "",
      input.tone ? `لحن: ${input.tone}` : "",
      "",
      renderThread(input.subject, input.messages),
      knowledgeBlock,
    ]
      .filter(Boolean)
      .join("\n"),
  })
  return object
}

// ---------------------------------------------------------------------------
// Summarize the ticket + triage signals
// ---------------------------------------------------------------------------
export const summarySchema = z.object({
  summary: z.string().describe("خلاصه کوتاه وضعیت تیکت در ۲ تا ۳ جمله"),
  sentiment: z.enum(["positive", "neutral", "negative"]).describe("لحن کلی کاربر"),
  priority: z.enum(["low", "medium", "high", "urgent"]).describe("فوریت پیشنهادی"),
  category: z
    .enum(["GENERAL", "PAYMENT", "ORDER", "REFUND", "TECHNICAL"])
    .describe("مناسب‌ترین دسته‌بندی"),
  nextAction: z.string().describe("اقدام بعدی پیشنهادی برای پشتیبان"),
})
export type TicketSummary = z.infer<typeof summarySchema>

export async function summarizeTicket(
  input: { subject: string; messages: ThreadMessage[] },
  actor: { userId?: string | null },
): Promise<TicketSummary> {
  const { object } = await runObject({
    feature: "support.summarize",
    schema: summarySchema,
    system: SUPPORT_SYSTEM,
    userId: actor.userId,
    prompt: [
      "این تیکت را برای تیم پشتیبانی تحلیل و خلاصه کن و سیگنال‌های تریاژ را استخراج کن.",
      "",
      renderThread(input.subject, input.messages),
    ].join("\n"),
  })
  return object
}
