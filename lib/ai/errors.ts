import { DomainError } from "@/lib/core/errors"

/** AI is globally disabled from the admin panel. */
export class AiDisabledError extends DomainError {
  constructor(message = "سرویس هوش مصنوعی غیرفعال است") {
    super(message, "AI_DISABLED", 503)
  }
}

/** No usable API key for the selected provider (neither DB nor env). */
export class AiNotConfiguredError extends DomainError {
  constructor(message = "کلید API برای ارائه‌دهنده انتخاب‌شده تنظیم نشده است") {
    super(message, "AI_NOT_CONFIGURED", 503)
  }
}

/** A daily token/cost guardrail was exceeded. */
export class AiBudgetExceededError extends DomainError {
  constructor(message = "سقف مصرف روزانه هوش مصنوعی پر شده است") {
    super(message, "AI_BUDGET_EXCEEDED", 429)
  }
}

/** The upstream model/provider call failed (after retries). */
export class AiProviderError extends DomainError {
  constructor(message = "خطا در ارتباط با مدل هوش مصنوعی") {
    super(message, "AI_PROVIDER_ERROR", 502)
  }
}
