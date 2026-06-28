import type { EmailTemplateKey } from "@prisma/client"

/**
 * Centralised, localized, branded transactional email templates.
 *
 * Every template is a pure function `(payload, ctx) => { subject, html, text }`.
 * They share one responsive, RTL-aware layout so branding stays consistent and
 * all-inline CSS keeps rendering correct across email clients (Gmail, Outlook,
 * Apple Mail, …). Add a new template by adding an `EmailTemplateKey` value and
 * a renderer in `RENDERERS` below — nothing else needs to change.
 */

export type Locale = "fa" | "en"

export interface RenderContext {
  locale: Locale
  /** Public base URL for building links/branding (no trailing slash). */
  baseUrl?: string
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

export type TemplatePayload = Record<string, unknown>

// --- Brand tokens (inline, matching the app's gold theme) -------------------

const BRAND = {
  bg: "#0f0f0f",
  card: "#1a1a1a",
  border: "#2a2a2a",
  accent: "#e9b949",
  accentText: "#1a1a1a",
  text: "#e8e8e8",
  muted: "#9a9a9a",
  subtle: "#7a7a7a",
  good: "#34d399",
  bad: "#f87171",
}

const APP_NAME = "Subio Shop"

// --- Small helpers ----------------------------------------------------------

function t(locale: Locale, fa: string, en: string): string {
  return locale === "en" ? en : fa
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function str(payload: TemplatePayload, key: string, fallback = ""): string {
  const v = payload[key]
  return v == null ? fallback : String(v)
}

function num(payload: TemplatePayload, key: string): number | null {
  const v = payload[key]
  if (v == null) return null
  const n = typeof v === "bigint" ? Number(v) : Number(v)
  return Number.isFinite(n) ? n : null
}

/** Format a Toman amount with thousands separators in the right locale. */
export function formatToman(value: number | null, locale: Locale): string {
  if (value == null) return "—"
  const formatted = new Intl.NumberFormat(locale === "en" ? "en-US" : "fa-IR").format(value)
  return t(locale, `${formatted} تومان`, `${formatted} Toman`)
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// --- Shared layout ----------------------------------------------------------

function button(href: string, label: string): string {
  return `
    <tr><td style="padding:24px 0 8px">
      <a href="${esc(href)}" target="_blank"
         style="display:inline-block;background:${BRAND.accent};color:${BRAND.accentText};
                text-decoration:none;font-weight:bold;font-size:15px;padding:13px 26px;border-radius:10px">
        ${esc(label)}
      </a>
    </td></tr>
    <tr><td style="font-size:12px;color:${BRAND.subtle};word-break:break-all;padding-top:6px">
      ${esc(href)}
    </td></tr>`
}

/** A key/value details block (orders, payments, …). */
export function detailsTable(rows: { label: string; value: string }[]): string {
  if (rows.length === 0) return ""
  const body = rows
    .map(
      (r) => `
      <tr>
        <td style="padding:7px 0;color:${BRAND.muted};font-size:13px">${esc(r.label)}</td>
        <td style="padding:7px 0;color:${BRAND.text};font-size:13px;font-weight:600;text-align:left">${esc(r.value)}</td>
      </tr>`,
    )
    .join("")
  return `
    <tr><td style="padding-top:8px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="border-collapse:collapse;background:#141414;border:1px solid ${BRAND.border};border-radius:12px;padding:6px 16px">
        ${body}
      </table>
    </td></tr>`
}

interface LayoutInput {
  locale: Locale
  title: string
  /** Inner HTML rows (already wrapped in <tr><td>…). */
  rows: string
  preheader?: string
  accent?: string
}

function layout(input: LayoutInput): string {
  const { locale } = input
  const dir = locale === "en" ? "ltr" : "rtl"
  const align = locale === "en" ? "left" : "right"
  const accent = input.accent ?? BRAND.accent
  const preheader = input.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(input.preheader)}</div>`
    : ""
  const footer = t(
    locale,
    "اگر این پیام برای شما ناآشناست، می‌توانید آن را نادیده بگیرید.",
    "If you didn't expect this email, you can safely ignore it.",
  )
  return `<!doctype html>
<html dir="${dir}" lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:0;background:${BRAND.bg};">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:24px 12px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="max-width:480px;background:${BRAND.card};border:1px solid ${BRAND.border};
                  border-radius:16px;overflow:hidden;font-family:Tahoma,Segoe UI,Arial,sans-serif">
      <tr><td style="padding:20px 28px;border-bottom:1px solid ${BRAND.border}">
        <span style="font-size:18px;font-weight:bold;color:${accent}">${esc(APP_NAME)}</span>
      </td></tr>
      <tr><td style="padding:24px 28px;text-align:${align};direction:${dir}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="font-size:18px;font-weight:bold;color:${accent};padding-bottom:14px">${esc(input.title)}</td></tr>
          ${input.rows}
        </table>
      </td></tr>
      <tr><td style="padding:16px 28px;border-top:1px solid ${BRAND.border}">
        <p style="margin:0;font-size:12px;color:${BRAND.subtle};text-align:${align};direction:${dir}">${footer}</p>
        <p style="margin:8px 0 0;font-size:11px;color:${BRAND.subtle};text-align:${align}">© ${new Date().getFullYear()} ${esc(APP_NAME)}</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

/** Wrap a paragraph of body text in the layout's content style. */
function para(html: string): string {
  return `<tr><td style="font-size:14px;line-height:1.9;color:${BRAND.text}">${html}</td></tr>`
}

// --- Renderers --------------------------------------------------------------

type Renderer = (payload: TemplatePayload, ctx: RenderContext) => RenderedEmail

function build(
  locale: Locale,
  subject: string,
  title: string,
  rows: string,
  preheader?: string,
  accent?: string,
): RenderedEmail {
  const html = layout({ locale, title, rows, preheader, accent })
  return { subject, html, text: stripHtml(html) }
}

const RENDERERS: Record<EmailTemplateKey, Renderer> = {
  WELCOME: (p, { locale }) => {
    const name = esc(str(p, "name"))
    const href = str(p, "actionUrl")
    return build(
      locale,
      t(locale, `${APP_NAME} | خوش آمدید`, `Welcome to ${APP_NAME}`),
      t(locale, "به جمع ما خوش آمدید", "Welcome aboard"),
      para(
        t(
          locale,
          `${name ? name + " عزیز، " : ""}حساب شما با موفقیت ساخته شد. از این پس می‌توانید در فروش‌های ویژه، مزایده‌ها و قرعه‌کشی‌ها شرکت کنید.`,
          `${name ? name + ", " : ""}your account is ready. You can now join flash sales, auctions and giveaways.`,
        ),
      ) + (href ? button(href, t(locale, "ورود به حساب", "Go to your account")) : ""),
      t(locale, "حساب شما فعال شد", "Your account is active"),
    )
  },

  EMAIL_VERIFICATION: (p, { locale }) => {
    const href = str(p, "verifyUrl") || str(p, "actionUrl")
    return build(
      locale,
      t(locale, "تأیید ایمیل — Subio Shop", "Verify your email — Subio Shop"),
      t(locale, "تأیید آدرس ایمیل", "Verify your email address"),
      para(
        t(
          locale,
          "برای فعال‌سازی ایمیل خود روی دکمه زیر بزنید. این لینک تا ۳۰ دقیقه معتبر است.",
          "Confirm your email by clicking the button below. This link is valid for 30 minutes.",
        ),
      ) + button(href, t(locale, "تأیید ایمیل", "Verify email")),
      t(locale, "ایمیل خود را تأیید کنید", "Confirm your email"),
    )
  },

  PASSWORD_RESET: (p, { locale }) => {
    const href = str(p, "resetUrl") || str(p, "actionUrl")
    return build(
      locale,
      t(locale, "بازیابی رمز عبور — Subio Shop", "Reset your password — Subio Shop"),
      t(locale, "بازیابی رمز عبور", "Reset your password"),
      para(
        t(
          locale,
          "برای تعیین رمز عبور جدید روی دکمه زیر بزنید. این لینک تا ۳۰ دقیقه معتبر است.",
          "Set a new password using the button below. This link is valid for 30 minutes.",
        ),
      ) + button(href, t(locale, "تعیین رمز جدید", "Set new password")),
      t(locale, "درخواست بازیابی رمز", "Password reset requested"),
    )
  },

  PURCHASE_CONFIRMATION: (p, { locale }) => {
    const product = esc(str(p, "productTitle"))
    const amount = formatToman(num(p, "amount"), locale)
    const orderId = str(p, "orderId")
    const href = str(p, "actionUrl")
    const rows = [
      { label: t(locale, "محصول", "Product"), value: str(p, "productTitle") },
      { label: t(locale, "مبلغ", "Amount"), value: amount },
      ...(orderId ? [{ label: t(locale, "شماره سفارش", "Order ID"), value: orderId }] : []),
    ]
    return build(
      locale,
      t(locale, `تأیید خرید «${product}»`, `Purchase confirmed: ${product}`),
      t(locale, "خرید شما ثبت شد", "Your purchase is confirmed"),
      para(
        t(
          locale,
          "از خرید شما سپاسگزاریم. جزئیات سفارش در ادامه آمده است.",
          "Thank you for your purchase. Your order details are below.",
        ),
      ) + detailsTable(rows) + (href ? button(href, t(locale, "مشاهده سفارش", "View order")) : ""),
      t(locale, "خرید با موفقیت انجام شد", "Purchase successful"),
    )
  },

  WALLET_DEPOSIT_APPROVED: (p, { locale }) => {
    const amount = formatToman(num(p, "amount"), locale)
    const href = str(p, "actionUrl")
    return build(
      locale,
      t(locale, "واریز شما تأیید شد", "Your deposit was approved"),
      t(locale, "واریز تأیید شد", "Deposit approved"),
      para(
        t(
          locale,
          `مبلغ ${amount} به کیف‌پول شما افزوده شد.`,
          `${amount} has been added to your wallet.`,
        ),
      ) + (href ? button(href, t(locale, "مشاهده کیف‌پول", "Open wallet")) : ""),
      t(locale, "موجودی کیف‌پول افزایش یافت", "Wallet credited"),
      BRAND.good,
    )
  },

  WALLET_DEPOSIT_REJECTED: (p, { locale }) => {
    const amount = formatToman(num(p, "amount"), locale)
    const reason = str(p, "reason")
    const href = str(p, "actionUrl")
    return build(
      locale,
      t(locale, "درخواست واریز رد شد", "Your deposit was rejected"),
      t(locale, "واریز رد شد", "Deposit rejected"),
      para(
        t(
          locale,
          `متأسفانه درخواست واریز ${amount} تأیید نشد.`,
          `Unfortunately your deposit of ${amount} was not approved.`,
        ) + (reason ? `<br><span style="color:${BRAND.muted}">${t(locale, "علت", "Reason")}: ${esc(reason)}</span>` : ""),
      ) + (href ? button(href, t(locale, "تلاش مجدد", "Try again")) : ""),
      t(locale, "درخواست واریز تأیید نشد", "Deposit not approved"),
      BRAND.bad,
    )
  },

  REFUND_COMPLETED: (p, { locale }) => {
    const amount = formatToman(num(p, "amount"), locale)
    const href = str(p, "actionUrl")
    return build(
      locale,
      t(locale, "بازگشت وجه انجام شد", "Your refund is complete"),
      t(locale, "بازگشت وجه تکمیل شد", "Refund completed"),
      para(
        t(
          locale,
          `مبلغ ${amount} به شما بازگردانده شد.`,
          `${amount} has been refunded to you.`,
        ),
      ) + (href ? button(href, t(locale, "مشاهده تراکنش", "View transaction")) : ""),
      t(locale, "وجه بازگردانده شد", "Money refunded"),
      BRAND.good,
    )
  },

  GIVEAWAY_WINNER: (p, { locale }) => {
    const prize = esc(str(p, "prize"))
    const href = str(p, "actionUrl")
    return build(
      locale,
      t(locale, "تبریک! شما برنده قرعه‌کشی شدید", "Congratulations! You won the giveaway"),
      t(locale, "شما برنده شدید!", "You're a winner!"),
      para(
        t(
          locale,
          `تبریک می‌گوییم! شما در قرعه‌کشی${prize ? ` «${prize}»` : ""} برنده شدید.`,
          `Congratulations! You won${prize ? ` "${prize}"` : ""} in our giveaway.`,
        ),
      ) + (href ? button(href, t(locale, "دریافت جایزه", "Claim your prize")) : ""),
      t(locale, "شما برنده قرعه‌کشی شدید", "You won the giveaway"),
    )
  },

  GIVEAWAY_REGISTRATION: (p, { locale }) => {
    const title = esc(str(p, "giveawayTitle"))
    const href = str(p, "actionUrl")
    return build(
      locale,
      t(locale, "ثبت‌نام شما در قرعه‌کشی تأیید شد", "You're entered in the giveaway"),
      t(locale, "ثبت‌نام موفق", "Entry confirmed"),
      para(
        t(
          locale,
          `ثبت‌نام شما در قرعه‌کشی${title ? ` «${title}»` : ""} با موفقیت انجام شد. در زمان قرعه‌کشی نتیجه را به شما اطلاع می‌دهیم.`,
          `You're successfully entered${title ? ` in "${title}"` : ""}. We'll notify you when the draw happens.`,
        ),
      ) + (href ? button(href, t(locale, "مشاهده قرعه‌کشی", "View giveaway")) : ""),
      t(locale, "در قرعه‌کشی شرکت داده شدید", "You're in the draw"),
    )
  },

  AUCTION_WINNER: (p, { locale }) => {
    const title = esc(str(p, "productTitle"))
    const amount = formatToman(num(p, "amount"), locale)
    const href = str(p, "actionUrl")
    const rows = [
      { label: t(locale, "محصول", "Item"), value: str(p, "productTitle") },
      { label: t(locale, "مبلغ برنده", "Winning bid"), value: amount },
    ]
    return build(
      locale,
      t(locale, `برنده مزایده «${title}» شدید`, `You won the auction: ${title}`),
      t(locale, "شما برنده مزایده شدید", "You won the auction"),
      para(
        t(
          locale,
          "تبریک! شما برنده این مزایده شدید. برای نهایی‌سازی پرداخت اقدام کنید.",
          "Congratulations! You won this auction. Please complete the payment to finalize.",
        ),
      ) + detailsTable(rows) + (href ? button(href, t(locale, "نهایی‌سازی پرداخت", "Complete payment")) : ""),
      t(locale, "برنده مزایده شدید", "Auction won"),
    )
  },

  AUCTION_OUTBID: (p, { locale }) => {
    const title = esc(str(p, "productTitle"))
    const amount = formatToman(num(p, "currentBid"), locale)
    const href = str(p, "actionUrl")
    return build(
      locale,
      t(locale, `پیشنهاد شما در «${title}» رد شد`, `You've been outbid: ${title}`),
      t(locale, "پیشنهاد بالاتری ثبت شد", "You've been outbid"),
      para(
        t(
          locale,
          `کاربر دیگری پیشنهاد بالاتری در مزایده${title ? ` «${title}»` : ""} ثبت کرد. بالاترین پیشنهاد فعلی ${amount} است.`,
          `Someone placed a higher bid${title ? ` on "${title}"` : ""}. The current top bid is ${amount}.`,
        ),
      ) + (href ? button(href, t(locale, "ثبت پیشنهاد جدید", "Place a new bid")) : ""),
      t(locale, "پیشنهاد شما رد شد", "Outbid notification"),
      BRAND.bad,
    )
  },

  VIP_ACTIVATED: (p, { locale }) => {
    const tier = esc(str(p, "tier"))
    const href = str(p, "actionUrl")
    return build(
      locale,
      t(locale, "عضویت ویژه شما فعال شد", "Your VIP membership is active"),
      t(locale, "به باشگاه ویژه خوش آمدید", "Welcome to VIP"),
      para(
        t(
          locale,
          `سطح${tier ? ` «${tier}»` : " ویژه"} شما فعال شد. از تخفیف‌ها و امکانات ویژه بهره‌مند شوید.`,
          `Your${tier ? ` "${tier}"` : " VIP"} tier is now active. Enjoy your exclusive perks and discounts.`,
        ),
      ) + (href ? button(href, t(locale, "مشاهده مزایا", "View benefits")) : ""),
      t(locale, "عضویت ویژه فعال شد", "VIP activated"),
    )
  },

  REFERRAL_REWARD: (p, { locale }) => {
    const amount = formatToman(num(p, "amount"), locale)
    const href = str(p, "actionUrl")
    return build(
      locale,
      t(locale, "پاداش دعوت شما واریز شد", "Your referral reward is here"),
      t(locale, "پاداش دعوت دریافت شد", "Referral reward earned"),
      para(
        t(
          locale,
          `بابت دعوت موفق، مبلغ ${amount} به حساب شما اضافه شد. دعوت بیشتر، پاداش بیشتر!`,
          `You earned ${amount} for a successful referral. Invite more friends to earn more!`,
        ),
      ) + (href ? button(href, t(locale, "دعوت دوستان", "Invite friends")) : ""),
      t(locale, "پاداش دعوت", "Referral reward"),
      BRAND.good,
    )
  },

  SUPPORT_REPLY: (p, { locale }) => {
    const ticket = str(p, "ticketId")
    const message = str(p, "message")
    const href = str(p, "actionUrl")
    return build(
      locale,
      t(locale, "پاسخ جدید به تیکت شما", "New reply to your support ticket"),
      t(locale, "پاسخ پشتیبانی", "Support reply"),
      para(
        t(
          locale,
          `پشتیبانی به تیکت${ticket ? ` #${esc(ticket)}` : ""} شما پاسخ داد:`,
          `Support replied to your ticket${ticket ? ` #${esc(ticket)}` : ""}:`,
        ) + (message ? `<br><br><span style="color:${BRAND.muted}">${esc(message)}</span>` : ""),
      ) + (href ? button(href, t(locale, "مشاهده تیکت", "View ticket")) : ""),
      t(locale, "پاسخ جدید پشتیبانی", "New support reply"),
    )
  },

  SECURITY_ALERT: (p, { locale }) => {
    const event = str(p, "event")
    const detail = str(p, "detail")
    const href = str(p, "actionUrl")
    return build(
      locale,
      t(locale, "هشدار امنیتی حساب شما", "Security alert on your account"),
      t(locale, "هشدار امنیتی", "Security alert"),
      para(
        t(
          locale,
          `فعالیت امنیتی مهمی روی حساب شما ثبت شد${event ? `: ${esc(event)}` : "."}`,
          `An important security event occurred on your account${event ? `: ${esc(event)}` : "."}`,
        ) + (detail ? `<br><span style="color:${BRAND.muted}">${esc(detail)}</span>` : "") +
          `<br><br>${t(locale, "اگر این شما نبودید، فوراً رمز عبور خود را تغییر دهید.", "If this wasn't you, change your password immediately.")}`,
      ) + (href ? button(href, t(locale, "بررسی امنیت حساب", "Review account security")) : ""),
      t(locale, "فعالیت امنیتی مهم", "Important security event"),
      BRAND.bad,
    )
  },

  GENERIC: (p, { locale }) => {
    // Free-form: accepts a pre-rendered `html`, or a `heading`/`body` pair, plus
    // an optional CTA. Used for ad-hoc/system mail (e.g. ops alerts).
    const subject = str(p, "subject", t(locale, "اعلان", "Notification"))
    const preRendered = str(p, "html")
    if (preRendered) {
      const html = layout({
        locale,
        title: str(p, "heading", subject),
        rows: para(preRendered),
      })
      return { subject, html, text: stripHtml(html) }
    }
    const heading = str(p, "heading", subject)
    const body = esc(str(p, "body"))
    const href = str(p, "actionUrl")
    const label = str(p, "actionLabel", t(locale, "مشاهده", "View"))
    return build(
      locale,
      subject,
      heading,
      para(body) + (href ? button(href, label) : ""),
    )
  },
}

/** Render a template to a subject + HTML + plain-text alternative. */
export function renderTemplate(
  template: EmailTemplateKey,
  payload: TemplatePayload,
  ctx: RenderContext,
): RenderedEmail {
  const renderer = RENDERERS[template] ?? RENDERERS.GENERIC
  return renderer(payload, ctx)
}

/** Persian labels for each template, for the admin UI. */
export const TEMPLATE_LABELS: Record<EmailTemplateKey, string> = {
  WELCOME: "خوش‌آمدگویی",
  EMAIL_VERIFICATION: "تأیید ایمیل",
  PASSWORD_RESET: "بازیابی رمز عبور",
  PURCHASE_CONFIRMATION: "تأیید خرید",
  WALLET_DEPOSIT_APPROVED: "تأیید واریز",
  WALLET_DEPOSIT_REJECTED: "رد واریز",
  REFUND_COMPLETED: "بازگشت وجه",
  GIVEAWAY_WINNER: "برنده قرعه‌کشی",
  GIVEAWAY_REGISTRATION: "ثبت‌نام قرعه‌کشی",
  AUCTION_WINNER: "برنده مزایده",
  AUCTION_OUTBID: "پیشنهاد بالاتر",
  VIP_ACTIVATED: "فعال‌سازی ویژه",
  REFERRAL_REWARD: "پاداش دعوت",
  SUPPORT_REPLY: "پاسخ پشتیبانی",
  SECURITY_ALERT: "هشدار امنیتی",
  GENERIC: "عمومی",
}
