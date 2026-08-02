-- Additive DDL for AI smart search + search insights.
-- Idempotent so it can be re-run safely and it sidesteps the unrelated
-- starsPayload index drift that blocks a full `prisma db push`.

-- pgvector must exist (already used by AiKnowledgeChunk, but guard anyway).
CREATE EXTENSION IF NOT EXISTS vector;

-- Product semantic-search embedding + freshness marker.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "embeddedAt" timestamp(3);

-- Approximate-NN index for fast cosine similarity over product embeddings.
CREATE INDEX IF NOT EXISTS "Product_embedding_hnsw"
  ON "Product" USING hnsw ("embedding" vector_cosine_ops);

-- Search source enum (guarded — CREATE TYPE has no IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SearchSource') THEN
    CREATE TYPE "SearchSource" AS ENUM ('WEB', 'TELEGRAM');
  END IF;
END
$$;

-- Search query log table.
CREATE TABLE IF NOT EXISTS "SearchQueryLog" (
  "id"          TEXT PRIMARY KEY,
  "query"       TEXT NOT NULL,
  "normalized"  TEXT NOT NULL,
  "source"      "SearchSource" NOT NULL DEFAULT 'WEB',
  "locale"      TEXT NOT NULL DEFAULT 'fa',
  "resultCount" INTEGER NOT NULL DEFAULT 0,
  "suggested"   BOOLEAN NOT NULL DEFAULT false,
  "userId"      TEXT,
  "createdAt"   timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "SearchQueryLog_normalized_idx" ON "SearchQueryLog" ("normalized");
CREATE INDEX IF NOT EXISTS "SearchQueryLog_createdAt_idx" ON "SearchQueryLog" ("createdAt");
CREATE INDEX IF NOT EXISTS "SearchQueryLog_resultCount_idx" ON "SearchQueryLog" ("resultCount");
CREATE INDEX IF NOT EXISTS "SearchQueryLog_source_createdAt_idx" ON "SearchQueryLog" ("source", "createdAt");
