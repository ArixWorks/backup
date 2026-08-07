import { z } from "zod"
import { uploadedFileUrl } from "@/lib/api/file-url"

/**
 * Wire schema for a ticket attachment forwarded from the client after a
 * successful upload. Every field is bounded and the `url` reuses the strict
 * uploaded-file validator (proxy path or https only) to block javascript:/data:
 * injection. The core layer re-derives `kind` defensively, so even a tampered
 * `kind`/`mimeType` here cannot change how a file is served.
 */
export const attachmentSchema = z.object({
  url: uploadedFileUrl,
  kind: z.enum(["IMAGE", "PDF", "TEXT"]),
  name: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(120),
  size: z.number().int().nonnegative().max(6 * 1024 * 1024),
  width: z.number().int().positive().max(100_000).nullish(),
  height: z.number().int().positive().max(100_000).nullish(),
})

/** At most 5 attachments per message. */
export const attachmentsSchema = z.array(attachmentSchema).max(5).optional()

export type AttachmentWire = z.infer<typeof attachmentSchema>

/** Normalize wire attachments into the core `AttachmentInput` shape. */
export function toAttachmentInputs(list: AttachmentWire[] | undefined) {
  return (list ?? []).map((a) => ({
    url: a.url,
    kind: a.kind,
    name: a.name,
    mimeType: a.mimeType,
    size: a.size,
    width: a.width ?? undefined,
    height: a.height ?? undefined,
  }))
}
