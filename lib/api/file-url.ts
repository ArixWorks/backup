import { z } from "zod"

/**
 * Validator for URLs produced by the upload endpoint. Accepts either:
 *  - an internal private-file proxy path (`/api/v1/files/...`) — used for
 *    sensitive documents (KYC, receipts, ticket attachments), or
 *  - an absolute https URL (public Blob URLs for legacy records and imagery).
 *
 * Rejecting everything else prevents javascript:/data: URI injection into
 * links that admins later click.
 */
export const uploadedFileUrl = z
  .string()
  .max(2048)
  .refine(
    (v) => v.startsWith("/api/v1/files/") || /^https:\/\//.test(v),
    "آدرس فایل نامعتبر است",
  )
