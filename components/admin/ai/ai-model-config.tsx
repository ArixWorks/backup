"use client"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, Toggle } from "./fields"
import { AI_KEYS, type ProviderDef } from "@/app/admin/ai/page"

export function AiModelConfig({
  form,
  set,
  providers,
  source,
}: {
  form: Record<string, string>
  set: (key: string, value: string) => void
  providers: ProviderDef[]
  source: Record<string, "db" | "env">
}) {
  const selectedProvider = form[AI_KEYS.provider] || "gateway"
  const providerDef = providers.find((p) => p.id === selectedProvider)
  const suggested = providerDef?.suggestedModels ?? []

  return (
    <div className="max-w-2xl space-y-5 rounded-xl border border-border bg-card p-5">
      <h2 className="text-lg font-extrabold">مدل و Provider</h2>

      <Field
        label="ارائه‌دهنده (Provider)"
        hint="کل ترافیک از طریق AI Gateway مسیردهی می‌شود؛ تغییر Provider نیازی به تغییر کد ندارد."
        source={source[AI_KEYS.provider]}
      >
        <Select value={selectedProvider} onValueChange={(v) => set(AI_KEYS.provider, v ?? "")}>
          <SelectTrigger>
            <SelectValue placeholder="انتخاب Provider" />
          </SelectTrigger>
          <SelectContent>
            {providers.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
                {p.gatewayZeroConfig ? " — بدون کلید" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field
        label="مدل"
        hint="رشته provider/model. می‌توانید هر مدلی که Gateway پشتیبانی می‌کند را تایپ کنید."
        source={source[AI_KEYS.model]}
      >
        <Input
          value={form[AI_KEYS.model] ?? ""}
          onChange={(e) => set(AI_KEYS.model, e.target.value)}
          placeholder="openai/gpt-5.2"
          className="font-mono"
          dir="ltr"
          list="ai-model-suggestions"
        />
        <datalist id="ai-model-suggestions">
          {suggested.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        {suggested.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {suggested.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => set(AI_KEYS.model, m)}
                className="rounded-full border border-border bg-secondary/60 px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                dir="ltr"
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="دما (Temperature)"
          hint="۰ = دقیق و قطعی، ۲ = خلاقانه"
          source={source[AI_KEYS.temperature]}
        >
          <Input
            type="number"
            step="0.1"
            min="0"
            max="2"
            value={form[AI_KEYS.temperature] ?? ""}
            onChange={(e) => set(AI_KEYS.temperature, e.target.value)}
            placeholder="0.7"
          />
        </Field>

        <Field
          label="حداکثر توکن خروجی"
          hint="۰ = پیش‌فرض مدل"
          source={source[AI_KEYS.maxTokens]}
        >
          <Input
            type="number"
            min="0"
            value={form[AI_KEYS.maxTokens] ?? ""}
            onChange={(e) => set(AI_KEYS.maxTokens, e.target.value)}
            placeholder="0"
          />
        </Field>

        <Field label="Timeout (میلی‌ثانیه)" hint="مهلت هر درخواست" source={source[AI_KEYS.timeoutMs]}>
          <Input
            type="number"
            min="1000"
            value={form[AI_KEYS.timeoutMs] ?? ""}
            onChange={(e) => set(AI_KEYS.timeoutMs, e.target.value)}
            placeholder="60000"
          />
        </Field>

        <Field label="تعداد Retry" hint="تلاش مجدد در خطاهای گذرا" source={source[AI_KEYS.maxRetries]}>
          <Input
            type="number"
            min="0"
            max="5"
            value={form[AI_KEYS.maxRetries] ?? ""}
            onChange={(e) => set(AI_KEYS.maxRetries, e.target.value)}
            placeholder="2"
          />
        </Field>
      </div>

      <div className="rounded-lg border border-border bg-secondary/40 p-3">
        <Toggle
          label="پاسخ‌دهی جریانی (Streaming)"
          hint="نمایش تدریجی پاسخ‌ها؛ در صورت خاموشی، پاسخ به‌صورت یکجا برمی‌گردد."
          checked={form[AI_KEYS.streaming] === "true"}
          onChange={(v) => set(AI_KEYS.streaming, v)}
        />
      </div>
    </div>
  )
}
