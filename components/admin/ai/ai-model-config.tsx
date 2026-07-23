"use client"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, Toggle } from "./fields"
import { AI_KEYS, type ProviderDef } from "@/app/admin/ai/page"
import { ModelTestControl } from "./model-test-control"

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
        <ModelTestControl model={form[AI_KEYS.model] ?? ""} capability="text" />
      </Field>

      <Field
        label="مدل سریع (اتوماسیون و کارهای پس‌زمینه)"
        hint="مدل کم‌تأخیر برای کارهای دسته‌ای مثل اتوماسیون‌ها و خلاصه‌های روزانه. مدل استدلالی پیش‌فرض برای این کارها کند است."
        source={source[AI_KEYS.fastModel]}
      >
        <Input
          value={form[AI_KEYS.fastModel] ?? ""}
          onChange={(e) => set(AI_KEYS.fastModel, e.target.value)}
          placeholder="openai/gpt-4.1-mini"
          className="font-mono"
          dir="ltr"
        />
        <ModelTestControl model={form[AI_KEYS.fastModel] ?? ""} capability="text" />
      </Field>

      <Field
        label="مدل تولید تصویر"
        hint="مدل مستقل ساخت تصویر از طریق AI Gateway. برای بیشترین کیفیت، GPT Image 2 پیشنهاد می‌شود."
        source={source[AI_KEYS.imageModel]}
      >
        <Input
          value={form[AI_KEYS.imageModel] ?? ""}
          onChange={(e) => set(AI_KEYS.imageModel, e.target.value)}
          placeholder="openai/gpt-image-2"
          className="font-mono"
          dir="ltr"
          list="ai-image-model-suggestions"
        />
        <datalist id="ai-image-model-suggestions">
          <option value="openai/gpt-image-2" />
          <option value="google/imagen-4.0-ultra-generate-001" />
          <option value="google/gemini-3-pro-image" />
        </datalist>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {[
            "openai/gpt-image-2",
            "google/imagen-4.0-ultra-generate-001",
            "google/gemini-3-pro-image",
          ].map((model) => (
            <button
              key={model}
              type="button"
              onClick={() => set(AI_KEYS.imageModel, model)}
              className="rounded-full border border-border bg-secondary/60 px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              dir="ltr"
            >
              {model}
            </button>
          ))}
        </div>
        <ModelTestControl model={form[AI_KEYS.imageModel] ?? ""} capability="image" />
      </Field>

      {/* Brand art-direction — consistent premium template + signature mascot */}
      <div className="space-y-4 rounded-lg border border-border bg-secondary/40 p-4">
        <Toggle
          label="قالب هنری برند (مسکات + تم پرمیوم)"
          hint="همه تصاویر محصولات با یک قالب سینمایی و یک مسکات ثابت ساخته می‌شوند؛ فقط محصول و رنگ لهجه (بر اساس دسته/عنوان) تغییر می‌کند. قیمت/تخفیف داخل عکس نوشته نمی‌شود."
          checked={form[AI_KEYS.imageBrandEnabled] !== "false"}
          onChange={(v) => set(AI_KEYS.imageBrandEnabled, v)}
        />

        {form[AI_KEYS.imageBrandEnabled] !== "false" && (
          <>
            <Field
              label="توضیح مسکات (کاراکتر برند)"
              hint="ظاهر ثابت آدمک برند. انگلیسی بنویسید تا مدل تصویر بهتر بسازد."
              source={source[AI_KEYS.imageBrandMascot]}
            >
              <Textarea
                value={form[AI_KEYS.imageBrandMascot] ?? ""}
                onChange={(e) => set(AI_KEYS.imageBrandMascot, e.target.value)}
                rows={5}
                dir="ltr"
                className="text-xs leading-relaxed"
              />
            </Field>

            <Field
              label="توضیح صحنه/تم پرمیوم"
              hint="نورپردازی، پس‌زمینه و حال‌وهوای مشترک همه تصاویر. انگلیسی بنویسید."
              source={source[AI_KEYS.imageBrandScene]}
            >
              <Textarea
                value={form[AI_KEYS.imageBrandScene] ?? ""}
                onChange={(e) => set(AI_KEYS.imageBrandScene, e.target.value)}
                rows={4}
                dir="ltr"
                className="text-xs leading-relaxed"
              />
            </Field>
          </>
        )}
      </div>

      <Field
        label="مدل Embedding (پایگاه دانش)"
        hint="برای نمایه‌سازی و جستجوی معنایی پایگاه دانش. باید ۱۵۳۶ بُعدی باشد تا با ستون vector سازگار بماند. تغییر آن نیازمند بازنمایه‌سازی اسناد است."
        source={source[AI_KEYS.embeddingModel]}
      >
        <Input
          value={form[AI_KEYS.embeddingModel] ?? ""}
          onChange={(e) => set(AI_KEYS.embeddingModel, e.target.value)}
          placeholder="openai/text-embedding-3-small"
          className="font-mono"
          dir="ltr"
        />
        <ModelTestControl model={form[AI_KEYS.embeddingModel] ?? ""} capability="embedding" />
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
