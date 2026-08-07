export const SUPPORT_CATEGORY_LABELS: Record<string, string> = {
  GENERAL: "عمومی",
  PAYMENT: "پرداخت و کیف پول",
  ORDER: "سفارش",
  REFUND: "بازگشت وجه",
  TECHNICAL: "مشکل فنی",
}

export const SUPPORT_STATUS_LABELS: Record<string, string> = {
  OPEN: "باز",
  IN_PROGRESS: "در حال بررسی",
  ANSWERED: "پاسخ داده شد",
  PENDING: "در انتظار پاسخ",
  CLOSED: "بسته شده",
}

/** Tailwind classes for a status pill. */
export const SUPPORT_STATUS_TONE: Record<string, string> = {
  OPEN: "bg-primary/15 text-primary",
  IN_PROGRESS: "bg-warning/15 text-warning",
  ANSWERED: "bg-success/15 text-success",
  PENDING: "bg-violet-500/15 text-violet-300",
  CLOSED: "bg-muted text-muted-foreground",
}

/** Combined label + pill classes, keyed by SupportStatus. */
export const SUPPORT_STATUS_META: Record<
  "OPEN" | "IN_PROGRESS" | "ANSWERED" | "PENDING" | "CLOSED",
  { label: string; className: string }
> = {
  OPEN: { label: SUPPORT_STATUS_LABELS.OPEN, className: SUPPORT_STATUS_TONE.OPEN },
  IN_PROGRESS: { label: SUPPORT_STATUS_LABELS.IN_PROGRESS, className: SUPPORT_STATUS_TONE.IN_PROGRESS },
  ANSWERED: { label: SUPPORT_STATUS_LABELS.ANSWERED, className: SUPPORT_STATUS_TONE.ANSWERED },
  PENDING: { label: SUPPORT_STATUS_LABELS.PENDING, className: SUPPORT_STATUS_TONE.PENDING },
  CLOSED: { label: SUPPORT_STATUS_LABELS.CLOSED, className: SUPPORT_STATUS_TONE.CLOSED },
}

export const REFUND_STATUS_LABELS: Record<string, string> = {
  PENDING: "در حال بررسی",
  APPROVED: "تأیید شده",
  REJECTED: "رد شده",
  PAID: "پرداخت شد",
}

export const REFUND_STATUS_TONE: Record<string, string> = {
  PENDING: "bg-warning/15 text-warning",
  APPROVED: "bg-success/15 text-success",
  REJECTED: "bg-destructive/15 text-destructive",
  PAID: "bg-success/15 text-success",
}

export const DEPOSIT_STATUS_LABELS: Record<string, string> = {
  PENDING: "در حال بررسی",
  APPROVED: "تأیید شده",
  REJECTED: "رد شده",
}

export const DEPOSIT_STATUS_TONE: Record<string, string> = {
  PENDING: "bg-warning/15 text-warning",
  APPROVED: "bg-success/15 text-success",
  REJECTED: "bg-destructive/15 text-destructive",
}
