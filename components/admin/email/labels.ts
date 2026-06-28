// Persian labels + tone for email statuses and template keys, shared across the
// admin email dashboard components.

export const STATUS_LABELS: Record<string, string> = {
  QUEUED: "در صف",
  PROCESSING: "در حال ارسال",
  SENT: "ارسال‌شده",
  DELIVERED: "تحویل‌شده",
  FAILED: "ناموفق",
  BOUNCED: "برگشتی",
  COMPLAINED: "شکایت اسپم",
  CANCELED: "لغوشده",
}

export const STATUS_TONE: Record<string, "good" | "bad" | "warn" | "muted"> = {
  QUEUED: "warn",
  PROCESSING: "warn",
  SENT: "good",
  DELIVERED: "good",
  FAILED: "bad",
  BOUNCED: "bad",
  COMPLAINED: "bad",
  CANCELED: "muted",
}

export const TEMPLATE_LABELS: Record<string, string> = {
  WELCOME: "خوش‌آمدگویی",
  EMAIL_VERIFICATION: "تأیید ایمیل",
  PASSWORD_RESET: "بازیابی رمز",
  PURCHASE_CONFIRMATION: "تأیید خرید",
  WALLET_DEPOSIT_APPROVED: "تأیید واریز",
  WALLET_DEPOSIT_REJECTED: "رد واریز",
  REFUND_COMPLETED: "بازگشت وجه",
  GIVEAWAY_WINNER: "برنده قرعه‌کشی",
  GIVEAWAY_REGISTRATION: "ثبت‌نام قرعه‌کشی",
  AUCTION_WINNER: "برنده مزایده",
  AUCTION_OUTBID: "پیشنهاد رد شد",
  VIP_ACTIVATED: "فعال‌سازی ویژه",
  REFERRAL_REWARD: "پاداش معرفی",
  SUPPORT_REPLY: "پاسخ پشتیبانی",
  SECURITY_ALERT: "هشدار امنیتی",
  GENERIC: "عمومی",
}
