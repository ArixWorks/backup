import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { getSetting, setSettings, SETTING_KEYS } from "@/lib/core/settings"
import { listSenders } from "@/lib/email/senders"

export const dynamic = "force-dynamic"

/** Read email configuration + the resolved sender identities preview. */
export const GET = route(async () => {
  await requireAdmin()
  const senders = (await listSenders()).map((s) => ({ id: s.id, label: s.label, from: s.resolved.from }))
  return {
    enabled: (await getSetting(SETTING_KEYS.emailEnabled)) === "true",
    fromName: await getSetting(SETTING_KEYS.emailFromName),
    domain: await getSetting(SETTING_KEYS.emailDomain),
    noreplyAddress: await getSetting(SETTING_KEYS.emailNoreplyAddress),
    supportAddress: await getSetting(SETTING_KEYS.emailSupportAddress),
    billingAddress: await getSetting(SETTING_KEYS.emailBillingAddress),
    securityAddress: await getSetting(SETTING_KEYS.emailSecurityAddress),
    replyTo: await getSetting(SETTING_KEYS.emailReplyTo),
    blockDisposable: (await getSetting(SETTING_KEYS.emailBlockDisposable)) === "true",
    ratePerMinute: Number(await getSetting(SETTING_KEYS.emailRatePerMinute)) || 60,
    batchSize: Number(await getSetting(SETTING_KEYS.emailBatchSize)) || 25,
    maxAttempts: Number(await getSetting(SETTING_KEYS.emailMaxAttempts)) || 5,
    openTracking: (await getSetting(SETTING_KEYS.emailOpenTracking)) !== "false",
    clickTracking: (await getSetting(SETTING_KEYS.emailClickTracking)) !== "false",
    providerConfigured: Boolean(process.env.RESEND_API_KEY),
    senders,
  }
})

const schema = z.object({
  enabled: z.boolean().optional(),
  fromName: z.string().trim().max(80).optional(),
  domain: z
    .string()
    .trim()
    .regex(/^$|^[a-z0-9.-]+\.[a-z]{2,}$/i, "دامنه نامعتبر است")
    .optional(),
  noreplyAddress: z.string().trim().max(120).optional(),
  supportAddress: z.string().trim().max(120).optional(),
  billingAddress: z.string().trim().max(120).optional(),
  securityAddress: z.string().trim().max(120).optional(),
  replyTo: z.string().trim().max(160).optional(),
  blockDisposable: z.boolean().optional(),
  ratePerMinute: z.number().int().min(1).max(1000).optional(),
  batchSize: z.number().int().min(1).max(200).optional(),
  maxAttempts: z.number().int().min(1).max(10).optional(),
  openTracking: z.boolean().optional(),
  clickTracking: z.boolean().optional(),
})

/** Update email configuration. */
export const PATCH = route(async (req: Request) => {
  await requireAdmin()
  const body = schema.parse(await req.json())
  const e: Record<string, string> = {}
  const bool = (v: boolean) => (v ? "true" : "false")

  if (body.enabled !== undefined) e[SETTING_KEYS.emailEnabled] = bool(body.enabled)
  if (body.fromName !== undefined) e[SETTING_KEYS.emailFromName] = body.fromName
  if (body.domain !== undefined) e[SETTING_KEYS.emailDomain] = body.domain
  if (body.noreplyAddress !== undefined) e[SETTING_KEYS.emailNoreplyAddress] = body.noreplyAddress
  if (body.supportAddress !== undefined) e[SETTING_KEYS.emailSupportAddress] = body.supportAddress
  if (body.billingAddress !== undefined) e[SETTING_KEYS.emailBillingAddress] = body.billingAddress
  if (body.securityAddress !== undefined) e[SETTING_KEYS.emailSecurityAddress] = body.securityAddress
  if (body.replyTo !== undefined) e[SETTING_KEYS.emailReplyTo] = body.replyTo
  if (body.blockDisposable !== undefined) e[SETTING_KEYS.emailBlockDisposable] = bool(body.blockDisposable)
  if (body.ratePerMinute !== undefined) e[SETTING_KEYS.emailRatePerMinute] = String(body.ratePerMinute)
  if (body.batchSize !== undefined) e[SETTING_KEYS.emailBatchSize] = String(body.batchSize)
  if (body.maxAttempts !== undefined) e[SETTING_KEYS.emailMaxAttempts] = String(body.maxAttempts)
  if (body.openTracking !== undefined) e[SETTING_KEYS.emailOpenTracking] = bool(body.openTracking)
  if (body.clickTracking !== undefined) e[SETTING_KEYS.emailClickTracking] = bool(body.clickTracking)

  if (Object.keys(e).length) await setSettings(e)
  return { ok: true }
})
