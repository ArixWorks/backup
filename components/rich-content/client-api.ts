"use client"

import { apiGet, apiPost } from "@/lib/api-client"
import type { InlineAction } from "@/components/rich-content/types"

export interface MediaAssetDTO {
  id: string
  url: string
  kind: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "ARCHIVE" | "OTHER"
  mimeType: string
  filename: string
  size: number
  width?: number | null
  height?: number | null
  blurDataUrl?: string | null
  alt?: string | null
  caption?: string | null
  tags: string[]
  createdAt: string
}

export interface LinkHit {
  type: string
  id: string
  label: string
  sub?: string
}

export interface SnippetDTO {
  id: string
  name: string
  category?: string | null
  html: string
}

/** List Media Library assets with optional search / kind / sort. */
export async function listMedia(params: {
  q?: string
  kind?: string
  sort?: string
  cursor?: string | null
}): Promise<{ items: MediaAssetDTO[]; nextCursor: string | null }> {
  const sp = new URLSearchParams()
  if (params.q) sp.set("q", params.q)
  if (params.kind) sp.set("kind", params.kind)
  if (params.sort) sp.set("sort", params.sort)
  if (params.cursor) sp.set("cursor", params.cursor)
  const res = await apiGet<{ items: MediaAssetDTO[]; nextCursor: string | null }>(
    `/api/v1/admin/media?${sp.toString()}`,
  )
  return res
}

/** Upload a file into the Media Library. Extra image metadata is optional. */
export async function uploadMedia(
  file: File,
  meta?: { alt?: string; caption?: string; blurDataUrl?: string; width?: number; height?: number },
): Promise<MediaAssetDTO> {
  const form = new FormData()
  form.append("file", file)
  if (meta?.alt) form.append("alt", meta.alt)
  if (meta?.caption) form.append("caption", meta.caption)
  if (meta?.blurDataUrl) form.append("blurDataUrl", meta.blurDataUrl)
  if (meta?.width) form.append("width", String(meta.width))
  if (meta?.height) form.append("height", String(meta.height))
  const res = await fetch("/api/v1/admin/media", { method: "POST", credentials: "include", body: form })
  const text = await res.text()
  const json = text ? JSON.parse(text) : {}
  if (!res.ok) throw new Error(json?.error?.message ?? "خطا در بارگذاری")
  return json.data as MediaAssetDTO
}

/** Live internal-link search for the [[...]] picker and link dialog. */
export async function searchLinks(q: string, type?: string): Promise<LinkHit[]> {
  const sp = new URLSearchParams({ q })
  if (type) sp.set("type", type)
  const res = await apiGet<{ items: LinkHit[] }>(`/api/v1/admin/link-search?${sp.toString()}`)
  return res.items
}

/** Run an AI inline action on an HTML fragment; returns rewritten HTML. */
export async function runInline(action: InlineAction, html: string, targetLocale?: string): Promise<string> {
  const res = await apiPost<{ html: string }>("/api/v1/admin/ai/content", {
    task: "inline",
    action,
    html,
    targetLocale,
  })
  return res.html
}

/** Snippets: list + save. */
export async function listSnippets(q?: string): Promise<SnippetDTO[]> {
  const sp = new URLSearchParams()
  if (q) sp.set("q", q)
  const res = await apiGet<{ items: SnippetDTO[] }>(`/api/v1/admin/snippets?${sp.toString()}`)
  return res.items
}

export async function saveSnippet(name: string, html: string, category?: string): Promise<SnippetDTO> {
  return apiPost<SnippetDTO>("/api/v1/admin/snippets", { name, html, category })
}
