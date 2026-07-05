import { convertToModelMessages, stepCountIs, type UIMessage } from "ai"
import { requireAiAdmin } from "@/lib/ai/permissions"
import { runStream } from "@/lib/ai/client"
import { copilotTools } from "@/lib/ai/copilot-tools"

export const maxDuration = 60

const SYSTEM = `تو دستیار هوشمند پنل مدیریت یک فروشگاه هستی.
- فقط به فارسی و کوتاه و دقیق پاسخ بده.
- برای پاسخ به سوالات درباره آمار، محصولات، کاربران و سفارش‌ها، حتماً از ابزارهای موجود استفاده کن و از حدس زدن بپرهیز.
- تو فقط دسترسی خواندنی داری؛ هیچ تغییری در داده‌ها ایجاد نکن و اگر از تو خواستند چیزی را تغییر بده، توضیح بده که این کار باید از طریق بخش مربوطه در پنل انجام شود.
- مبالغ مالی به کوچک‌ترین واحد (سنت/ریال) هستند؛ در صورت نیاز این را توضیح بده.
- اگر داده‌ای یافت نشد، صادقانه بگو.`

export async function POST(req: Request) {
  let admin
  try {
    admin = await requireAiAdmin()
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "دسترسی غیرمجاز" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  try {
    const { messages }: { messages: UIMessage[] } = await req.json()
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "پیام نامعتبر است" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      })
    }

    const out = await runStream({
      feature: "copilot",
      userId: admin.id,
      system: SYSTEM,
      messages: await convertToModelMessages(messages),
      tools: copilotTools,
      stopWhen: stepCountIs(6),
      refType: "admin",
      refId: admin.id,
    })

    if (!out.streamed) {
      // Streaming disabled by admin — return the buffered text as a minimal stream-compatible payload.
      return new Response(JSON.stringify({ ok: true, text: out.text }), {
        headers: { "content-type": "application/json" },
      })
    }

    return out.result.toUIMessageStreamResponse()
  } catch (err) {
    const message = err instanceof Error ? err.message : "خطای ناشناخته"
    console.log("[v0] copilot route error:", message)
    return new Response(JSON.stringify({ ok: false, error: "خطا در سرویس دستیار" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }
}
