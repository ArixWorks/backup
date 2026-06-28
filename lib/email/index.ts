import "server-only"
import { EmailTemplateKey, EmailSenderId } from "@prisma/client"
import { enqueueEmail, type EnqueueResult } from "@/lib/email/queue"

/**
 * Public, intention-revealing helpers for every transactional email. Callers
 * use these instead of touching the queue directly, so trigger sites stay
 * readable and the payload shape for each template lives in one place.
 *
 * All helpers are best-effort and never throw: a mail failure must not break
 * the business transaction that triggered it.
 */

type Base = { to?: string; userId?: string; locale?: "fa" | "en" }

async function safe(p: Promise<EnqueueResult>): Promise<EnqueueResult> {
  try {
    return await p
  } catch (err) {
    console.log("[v0] email enqueue failed:", err instanceof Error ? err.message : String(err))
    return { queued: false, reason: "enqueue-error" }
  }
}

export function sendWelcomeEmail(args: Base & { name?: string }) {
  return safe(
    enqueueEmail({
      template: EmailTemplateKey.WELCOME,
      sender: EmailSenderId.NOREPLY,
      to: args.to,
      userId: args.userId,
      locale: args.locale,
      payload: { name: args.name },
    }),
  )
}

export function sendVerificationEmail(args: Base & { code: string; verifyUrl?: string }) {
  return safe(
    enqueueEmail({
      template: EmailTemplateKey.EMAIL_VERIFICATION,
      sender: EmailSenderId.NOREPLY,
      to: args.to,
      userId: args.userId,
      locale: args.locale,
      payload: { code: args.code, verifyUrl: args.verifyUrl },
      // Verification should not be deduped away if re-requested.
      idempotencyKey: `verify:${args.userId ?? args.to}:${args.code}`,
      priority: 1,
    }),
  )
}

export function sendPasswordResetEmail(args: Base & { resetUrl: string; code?: string }) {
  return safe(
    enqueueEmail({
      template: EmailTemplateKey.PASSWORD_RESET,
      sender: EmailSenderId.SECURITY,
      to: args.to,
      userId: args.userId,
      locale: args.locale,
      payload: { resetUrl: args.resetUrl, code: args.code },
      idempotencyKey: `reset:${args.userId ?? args.to}:${args.code ?? Date.now()}`,
      priority: 1,
    }),
  )
}

export function sendPurchaseConfirmationEmail(
  args: Base & { orderId: string; productName: string; amount: string; currency: string },
) {
  return safe(
    enqueueEmail({
      template: EmailTemplateKey.PURCHASE_CONFIRMATION,
      sender: EmailSenderId.BILLING,
      to: args.to,
      userId: args.userId,
      locale: args.locale,
      payload: { orderId: args.orderId, productName: args.productName, amount: args.amount, currency: args.currency },
      idempotencyKey: `order:${args.orderId}`,
    }),
  )
}

export function sendDepositApprovedEmail(args: Base & { amount: string; currency: string; depositId: string }) {
  return safe(
    enqueueEmail({
      template: EmailTemplateKey.WALLET_DEPOSIT_APPROVED,
      sender: EmailSenderId.BILLING,
      to: args.to,
      userId: args.userId,
      locale: args.locale,
      payload: { amount: args.amount, currency: args.currency },
      idempotencyKey: `deposit-approved:${args.depositId}`,
    }),
  )
}

export function sendDepositRejectedEmail(args: Base & { amount: string; currency: string; depositId: string; reason?: string }) {
  return safe(
    enqueueEmail({
      template: EmailTemplateKey.WALLET_DEPOSIT_REJECTED,
      sender: EmailSenderId.BILLING,
      to: args.to,
      userId: args.userId,
      locale: args.locale,
      payload: { amount: args.amount, currency: args.currency, reason: args.reason },
      idempotencyKey: `deposit-rejected:${args.depositId}`,
    }),
  )
}

export function sendRefundCompletedEmail(args: Base & { amount: string; currency: string; refundId: string }) {
  return safe(
    enqueueEmail({
      template: EmailTemplateKey.REFUND_COMPLETED,
      sender: EmailSenderId.BILLING,
      to: args.to,
      userId: args.userId,
      locale: args.locale,
      payload: { amount: args.amount, currency: args.currency },
      idempotencyKey: `refund:${args.refundId}`,
    }),
  )
}

export function sendGiveawayWinnerEmail(args: Base & { giveawayId: string; prize: string }) {
  return safe(
    enqueueEmail({
      template: EmailTemplateKey.GIVEAWAY_WINNER,
      sender: EmailSenderId.NOREPLY,
      to: args.to,
      userId: args.userId,
      locale: args.locale,
      payload: { prize: args.prize },
      idempotencyKey: `giveaway-win:${args.giveawayId}:${args.userId ?? args.to}`,
    }),
  )
}

export function sendGiveawayRegistrationEmail(args: Base & { giveawayId: string; title: string }) {
  return safe(
    enqueueEmail({
      template: EmailTemplateKey.GIVEAWAY_REGISTRATION,
      sender: EmailSenderId.NOREPLY,
      to: args.to,
      userId: args.userId,
      locale: args.locale,
      payload: { title: args.title },
      idempotencyKey: `giveaway-reg:${args.giveawayId}:${args.userId ?? args.to}`,
    }),
  )
}

export function sendAuctionWinnerEmail(args: Base & { auctionId: string; title: string; amount: string; currency: string }) {
  return safe(
    enqueueEmail({
      template: EmailTemplateKey.AUCTION_WINNER,
      sender: EmailSenderId.NOREPLY,
      to: args.to,
      userId: args.userId,
      locale: args.locale,
      payload: { title: args.title, amount: args.amount, currency: args.currency },
      idempotencyKey: `auction-win:${args.auctionId}`,
    }),
  )
}

export function sendAuctionOutbidEmail(args: Base & { auctionId: string; title: string; bidId: string }) {
  return safe(
    enqueueEmail({
      template: EmailTemplateKey.AUCTION_OUTBID,
      sender: EmailSenderId.NOREPLY,
      to: args.to,
      userId: args.userId,
      locale: args.locale,
      payload: { title: args.title },
      idempotencyKey: `auction-outbid:${args.auctionId}:${args.bidId}`,
    }),
  )
}

export function sendVipActivatedEmail(args: Base & { tier: string; expiresAt?: string; membershipId: string }) {
  return safe(
    enqueueEmail({
      template: EmailTemplateKey.VIP_ACTIVATED,
      sender: EmailSenderId.NOREPLY,
      to: args.to,
      userId: args.userId,
      locale: args.locale,
      payload: { tier: args.tier, expiresAt: args.expiresAt },
      idempotencyKey: `vip:${args.membershipId}`,
    }),
  )
}

export function sendReferralRewardEmail(args: Base & { amount: string; currency: string; refId: string }) {
  return safe(
    enqueueEmail({
      template: EmailTemplateKey.REFERRAL_REWARD,
      sender: EmailSenderId.NOREPLY,
      to: args.to,
      userId: args.userId,
      locale: args.locale,
      payload: { amount: args.amount, currency: args.currency },
      idempotencyKey: `referral-reward:${args.refId}`,
    }),
  )
}

export function sendSupportReplyEmail(args: Base & { ticketId: string; subject: string; message: string }) {
  return safe(
    enqueueEmail({
      template: EmailTemplateKey.SUPPORT_REPLY,
      sender: EmailSenderId.SUPPORT,
      to: args.to,
      userId: args.userId,
      locale: args.locale,
      payload: { ticketId: args.ticketId, subject: args.subject, message: args.message },
      // Each reply is unique.
      idempotencyKey: `support-reply:${args.ticketId}:${Date.now()}`,
    }),
  )
}

export function sendSecurityAlertEmail(args: Base & { event: string; detail?: string; ip?: string; when?: string }) {
  return safe(
    enqueueEmail({
      template: EmailTemplateKey.SECURITY_ALERT,
      sender: EmailSenderId.SECURITY,
      to: args.to,
      userId: args.userId,
      locale: args.locale,
      payload: { event: args.event, detail: args.detail, ip: args.ip, when: args.when },
      idempotencyKey: `security:${args.userId ?? args.to}:${args.event}:${Date.now()}`,
      priority: 2,
    }),
  )
}

export { enqueueEmail } from "@/lib/email/queue"
export { processEmailQueue } from "@/lib/email/worker"
export { getEmailStats, getTemplateBreakdown, getDailyVolume } from "@/lib/email/analytics"
