import "server-only"
import type { EmailSenderId } from "@prisma/client"
import { SETTING_KEYS, getSetting } from "@/lib/core/settings"

/**
 * Resolves which verified sender identity (From address + optional Reply-To) to
 * use for a given email type. Identities are configured in settings so the
 * sending domain can change per environment without code edits.
 *
 * Resolution order for the domain:
 *   1. `email.domain` setting (e.g. "subio.shop")
 *   2. the domain of RESEND_FROM env (e.g. "Subio <noreply@subio.shop>")
 *   3. fallback to Resend's shared onboarding sender (dev only — can only mail
 *      the account owner, never real customers).
 */

const FALLBACK_FROM = "Subio Shop <onboarding@resend.dev>"

export const SENDER_LABELS: Record<EmailSenderId, string> = {
  NOREPLY: "بدون پاسخ",
  SUPPORT: "پشتیبانی",
  BILLING: "مالی و صورتحساب",
  SECURITY: "امنیت",
}

function parseDomainFromResendFrom(): string | null {
  const raw = process.env.RESEND_FROM
  if (!raw) return null
  const match = raw.match(/<([^>]+)>/)
  const addr = (match ? match[1] : raw).trim()
  const at = addr.lastIndexOf("@")
  return at === -1 ? null : addr.slice(at + 1)
}

interface SenderSettings {
  fromName: string
  domain: string
  replyTo: string
  addresses: Record<EmailSenderId, string>
}

async function loadSenderSettings(): Promise<SenderSettings> {
  const [fromName, domain, replyTo, noreply, support, billing, security] = await Promise.all([
    getSetting(SETTING_KEYS.emailFromName),
    getSetting(SETTING_KEYS.emailDomain),
    getSetting(SETTING_KEYS.emailReplyTo),
    getSetting(SETTING_KEYS.emailNoreplyAddress),
    getSetting(SETTING_KEYS.emailSupportAddress),
    getSetting(SETTING_KEYS.emailBillingAddress),
    getSetting(SETTING_KEYS.emailSecurityAddress),
  ])
  return {
    fromName: fromName || "Subio Shop",
    domain: domain.trim(),
    replyTo: replyTo.trim(),
    addresses: { NOREPLY: noreply, SUPPORT: support, BILLING: billing, SECURITY: security },
  }
}

function buildAddress(localOrFull: string, domain: string): string | null {
  const value = (localOrFull || "").trim()
  if (!value) return null
  // Allow a full address in the setting; otherwise combine the local part with
  // the configured domain.
  if (value.includes("@")) return value
  if (!domain) return null
  return `${value}@${domain}`
}

export interface ResolvedSender {
  /** Full From header value, e.g. `Subio Shop <noreply@subio.shop>`. */
  from: string
  replyTo?: string
  /** True when we fell back to the shared dev sender (cannot reach customers). */
  isFallback: boolean
}

/** Resolve the From/Reply-To for a sender identity. Pure read of settings/env. */
export async function resolveSender(senderId: EmailSenderId): Promise<ResolvedSender> {
  const cfg = await loadSenderSettings()
  const domain = cfg.domain || parseDomainFromResendFrom() || ""
  const address = buildAddress(cfg.addresses[senderId], domain)

  if (!address) {
    // No verified domain configured — fall back to env RESEND_FROM or the
    // shared onboarding sender. Works in dev; real delivery needs a domain.
    return { from: process.env.RESEND_FROM || FALLBACK_FROM, isFallback: true }
  }

  const from = `${cfg.fromName} <${address}>`
  const replyTo = cfg.replyTo || undefined
  return { from, replyTo, isFallback: false }
}

/** All sender identities with their resolved addresses, for the admin UI. */
export async function listSenders(): Promise<
  { id: EmailSenderId; label: string; resolved: ResolvedSender }[]
> {
  const ids: EmailSenderId[] = ["NOREPLY", "SUPPORT", "BILLING", "SECURITY"]
  const resolved = await Promise.all(ids.map((id) => resolveSender(id)))
  return ids.map((id, i) => ({ id, label: SENDER_LABELS[id], resolved: resolved[i] }))
}
