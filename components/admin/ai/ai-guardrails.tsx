"use client"

import { Input } from "@/components/ui/input"
import { Field } from "./fields"
import { AI_KEYS } from "@/app/admin/ai/page"

export function AiGuardrails({
  form,
  set,
  source,
}: {
  form: Record<string, string>
  set: (key: string, value: string) => void
  source: Record<string, "db" | "env">
}) {
  return (
    <div className="max-w-2xl space-y-5 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="text-lg font-extrabold">محدودیت‌ها و امنیت</h2>
        <p className="text-xs text-muted-foreground">
          سقف مصرف روزانه و نرخ درخواست کاربران. مقدار ۰ یعنی نامحدود.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="سقف توکن روزانه"
          hint="کل توکن مصرفی پلتفرم در هر روز"
          source={source[AI_KEYS.dailyTokenLimit]}
        >
          <Input
            type="number"
            min="0"
            value={form[AI_KEYS.dailyTokenLimit] ?? ""}
            onChange={(e) => set(AI_KEYS.dailyTokenLimit, e.target.value)}
            placeholder="0"
          />
        </Field>

        <Field
          label="سقف هزینه روزانه (دلار)"
          hint="حداکثر هزینه تخمینی در هر روز"
          source={source[AI_KEYS.dailyCostLimitUsd]}
        >
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form[AI_KEYS.dailyCostLimitUsd] ?? ""}
            onChange={(e) => set(AI_KEYS.dailyCostLimitUsd, e.target.value)}
            placeholder="0"
          />
        </Field>

        <Field
          label="نرخ هر کاربر (در دقیقه)"
          hint="حداکثر درخواست AI هر کاربر در دقیقه"
          source={source[AI_KEYS.userRatePerMin]}
        >
          <Input
            type="number"
            min="0"
            value={form[AI_KEYS.userRatePerMin] ?? ""}
            onChange={(e) => set(AI_KEYS.userRatePerMin, e.target.value)}
            placeholder="20"
          />
        </Field>
      </div>
    </div>
  )
}
