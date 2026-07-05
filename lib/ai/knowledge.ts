import "server-only"
import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/db"
import { embedTexts } from "./client"

/**
 * AI Knowledge Base (RAG).
 *
 * Documents are stored in `AiKnowledgeDoc` and split into `AiKnowledgeChunk`
 * rows, each with a pgvector embedding. Because Prisma can't type the `vector`
 * column, all embedding writes and similarity reads use raw SQL with a
 * `::vector` cast and the cosine-distance operator `<=>`.
 *
 * Everything routes embeddings through the shared AI core (`embedTexts`), so the
 * master switch, guardrails and usage tracking all apply automatically.
 */

const MAX_CHUNK_CHARS = 1200
const CHUNK_OVERLAP = 150

/** Split text into overlapping, paragraph-aware chunks. */
export function chunkText(
  text: string,
  maxChars = MAX_CHUNK_CHARS,
  overlap = CHUNK_OVERLAP,
): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim()
  if (!clean) return []
  if (clean.length <= maxChars) return [clean]

  const paragraphs = clean.split(/\n{2,}/)
  const chunks: string[] = []
  let current = ""

  for (const para of paragraphs) {
    const p = para.trim()
    if (!p) continue
    if ((current + "\n\n" + p).length <= maxChars) {
      current = current ? `${current}\n\n${p}` : p
      continue
    }
    if (current) chunks.push(current)
    if (p.length <= maxChars) {
      current = p
    } else {
      // Hard-split an oversized paragraph with overlap.
      for (let i = 0; i < p.length; i += maxChars - overlap) {
        chunks.push(p.slice(i, i + maxChars))
      }
      current = ""
    }
  }
  if (current) chunks.push(current)
  return chunks
}

/** Serialize a JS number[] into the pgvector text literal `[a,b,c]`. */
function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`
}

/** Rough token estimate for display/analytics (not billing-critical). */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export interface KnowledgeDocInput {
  title: string
  content: string
  source?: string
  sourceUrl?: string | null
  category?: string | null
  locale?: string
  isPublic?: boolean
  createdById?: string | null
}

/**
 * (Re)build the chunk + embedding rows for a document. Deletes any existing
 * chunks first, so it is safe to call on both create and update.
 */
export async function ingestDoc(docId: string, actorId?: string | null): Promise<number> {
  const doc = await prisma.aiKnowledgeDoc.findUnique({ where: { id: docId } })
  if (!doc) throw new Error("سند یافت نشد")

  await prisma.aiKnowledgeDoc.update({
    where: { id: docId },
    data: { status: "INDEXING", error: null },
  })

  try {
    const chunks = chunkText(doc.content)
    await prisma.aiKnowledgeChunk.deleteMany({ where: { docId } })

    if (chunks.length > 0) {
      const embeddings = await embedTexts(chunks, {
        feature: "knowledge.embed",
        userId: actorId,
      })
      // Insert each chunk with its embedding via raw SQL (vector cast).
      for (let i = 0; i < chunks.length; i++) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "AiKnowledgeChunk" (id, "docId", idx, content, tokens, embedding, "createdAt")
           VALUES ($1, $2, $3, $4, $5, $6::vector, now())`,
          randomUUID(),
          docId,
          i,
          chunks[i],
          estimateTokens(chunks[i]),
          toVectorLiteral(embeddings[i]),
        )
      }
    }

    await prisma.aiKnowledgeDoc.update({
      where: { id: docId },
      data: { status: "READY", chunkCount: chunks.length, error: null },
    })
    return chunks.length
  } catch (err) {
    const message = err instanceof Error ? err.message : "خطای نامشخص"
    await prisma.aiKnowledgeDoc.update({
      where: { id: docId },
      data: { status: "ERROR", error: message.slice(0, 300) },
    })
    throw err
  }
}

export async function createDoc(input: KnowledgeDocInput) {
  const doc = await prisma.aiKnowledgeDoc.create({
    data: {
      title: input.title,
      content: input.content,
      source: input.source ?? "manual",
      sourceUrl: input.sourceUrl ?? null,
      category: input.category ?? null,
      locale: input.locale ?? "fa",
      isPublic: input.isPublic ?? true,
      createdById: input.createdById ?? null,
      status: "INDEXING",
    },
  })
  await ingestDoc(doc.id, input.createdById)
  return prisma.aiKnowledgeDoc.findUnique({ where: { id: doc.id } })
}

export async function updateDoc(
  id: string,
  input: Partial<KnowledgeDocInput>,
  actorId?: string | null,
) {
  const existing = await prisma.aiKnowledgeDoc.findUnique({ where: { id } })
  if (!existing) throw new Error("سند یافت نشد")

  const contentChanged = input.content !== undefined && input.content !== existing.content

  await prisma.aiKnowledgeDoc.update({
    where: { id },
    data: {
      title: input.title ?? existing.title,
      content: input.content ?? existing.content,
      sourceUrl: input.sourceUrl === undefined ? existing.sourceUrl : input.sourceUrl,
      category: input.category === undefined ? existing.category : input.category,
      locale: input.locale ?? existing.locale,
      isPublic: input.isPublic ?? existing.isPublic,
    },
  })

  if (contentChanged) await ingestDoc(id, actorId)
  return prisma.aiKnowledgeDoc.findUnique({ where: { id } })
}

export async function deleteDoc(id: string) {
  await prisma.aiKnowledgeDoc.delete({ where: { id } })
}

export async function listDocs() {
  return prisma.aiKnowledgeDoc.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      source: true,
      sourceUrl: true,
      category: true,
      locale: true,
      isPublic: true,
      status: true,
      chunkCount: true,
      error: true,
      createdAt: true,
      updatedAt: true,
    },
  })
}

export async function getDoc(id: string) {
  return prisma.aiKnowledgeDoc.findUnique({ where: { id } })
}

export interface KnowledgeHit {
  chunkId: string
  docId: string
  title: string
  category: string | null
  sourceUrl: string | null
  content: string
  similarity: number
}

/**
 * Semantic search over the knowledge base. Embeds the query and ranks chunks by
 * cosine similarity. `publicOnly` restricts to user-facing docs (support), while
 * admin surfaces (Copilot) can search everything.
 */
export async function searchKnowledge(
  query: string,
  opts: { limit?: number; publicOnly?: boolean; minSimilarity?: number; userId?: string | null } = {},
): Promise<KnowledgeHit[]> {
  const q = query.trim()
  if (!q) return []
  const limit = opts.limit ?? 5
  const publicOnly = opts.publicOnly ?? false
  const minSimilarity = opts.minSimilarity ?? 0.3

  const [embedding] = await embedTexts([q], { feature: "knowledge.search", userId: opts.userId })
  const literal = toVectorLiteral(embedding)

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      chunkId: string
      docId: string
      title: string
      category: string | null
      sourceUrl: string | null
      content: string
      similarity: number
    }>
  >(
    `SELECT c.id AS "chunkId", c."docId" AS "docId", c.content AS content,
            d.title AS title, d.category AS category, d."sourceUrl" AS "sourceUrl",
            1 - (c.embedding <=> $1::vector) AS similarity
     FROM "AiKnowledgeChunk" c
     JOIN "AiKnowledgeDoc" d ON d.id = c."docId"
     WHERE c.embedding IS NOT NULL
       AND d.status = 'READY'
       AND ($2::boolean = false OR d."isPublic" = true)
     ORDER BY c.embedding <=> $1::vector
     LIMIT $3`,
    literal,
    publicOnly,
    limit,
  )

  return rows
    .map((r) => ({ ...r, similarity: Number(r.similarity) }))
    .filter((r) => r.similarity >= minSimilarity)
}
