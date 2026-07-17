-- P5: pgvector-backed search runtime (SearchIndexVector), dual-written alongside the
-- existing JSON KnowledgeChunkEmbedding.vector column. ALWAYS query-scoped by
-- searchIndexGenerationId (never cross-generation) — see src/lib/search-vector/.
--
-- Dimension: JYKSTORE_EMBEDDING_DIMENSION (default 256, matching the local-hash
-- foundation provider). pgvector's "vector" type is itself unbounded/typmod-less at
-- the column-definition level here (no fixed vector(n)), so a production deployment
-- switching providers/dimensions (e.g. OpenAI text-embedding-3-small = 1536) does not
-- require a new migration — application code (search-vector-store.ts) is responsible
-- for validating that every write matches SearchIndexGeneration.embeddingDimension.
--
-- Resilience note: pgvector may not be installed on every Postgres instance (e.g. local
-- dev on Windows without the extension binaries — verified missing during P5 development;
-- `SELECT * FROM pg_available_extensions WHERE name='vector'` returned no rows). Failing
-- this migration would break `prisma migrate deploy` for everyone, including environments
-- that will never run vector search. So:
--   1) CREATE EXTENSION is attempted but swallows errors (logs a NOTICE instead of failing).
--   2) The SearchIndexVector table + indexes are only created when the "vector" type
--      actually exists after step 1.
-- Downstream code (search-vector-store.ts / search-vector-query.ts) detects a missing
-- table/type at query time and treats it as "pgvector unavailable": development/test
-- fall back to JSON-only embeddings (NODE_ENV !== "production"); production throws
-- SEARCH_RUNTIME_UNAVAILABLE with no silent fallback. Production deployments MUST install
-- pgvector before relying on vector search.
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension unavailable, continuing without it: %', SQLERRM;
  END;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
    CREATE TABLE "SearchIndexVector" (
      "id"                      TEXT NOT NULL,
      "searchIndexGenerationId" TEXT NOT NULL,
      "chunkId"                 TEXT NOT NULL,
      "provider"                TEXT NOT NULL,
      "model"                   TEXT NOT NULL,
      "dimension"               INTEGER NOT NULL,
      "contentHash"             TEXT NOT NULL,
      "vector"                  vector NOT NULL,
      "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"               TIMESTAMP(3) NOT NULL,

      CONSTRAINT "SearchIndexVector_pkey" PRIMARY KEY ("id")
    );

    CREATE UNIQUE INDEX "SearchIndexVector_searchIndexGenerationId_chunkId_provide_key"
      ON "SearchIndexVector"("searchIndexGenerationId", "chunkId", "provider", "model");

    CREATE INDEX "SearchIndexVector_searchIndexGenerationId_idx"
      ON "SearchIndexVector"("searchIndexGenerationId");

    CREATE INDEX "SearchIndexVector_chunkId_idx" ON "SearchIndexVector"("chunkId");

    ALTER TABLE "SearchIndexVector"
      ADD CONSTRAINT "SearchIndexVector_searchIndexGenerationId_fkey"
      FOREIGN KEY ("searchIndexGenerationId") REFERENCES "SearchIndexGeneration"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;

    -- HNSW (pgvector >= 0.5.0) preferred; fall back to ivfflat; skip entirely rather than
    -- fail the migration if neither access method is available on this pgvector version.
    BEGIN
      EXECUTE 'CREATE INDEX "SearchIndexVector_vector_hnsw_idx" ON "SearchIndexVector" USING hnsw ("vector" vector_cosine_ops)';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'HNSW vector index unavailable, trying ivfflat: %', SQLERRM;
      BEGIN
        EXECUTE 'CREATE INDEX "SearchIndexVector_vector_ivfflat_idx" ON "SearchIndexVector" USING ivfflat ("vector" vector_cosine_ops)';
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'ivfflat vector index unavailable either; continuing without a vector index (exact scan only): %', SQLERRM;
      END;
    END;
  ELSE
    RAISE NOTICE 'pgvector type "vector" not found — SearchIndexVector table was NOT created. Vector search falls back to JSON-only embeddings until pgvector is installed (blocked in production).';
  END IF;
END $$;
