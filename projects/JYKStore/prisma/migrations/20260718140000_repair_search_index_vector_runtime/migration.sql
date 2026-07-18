-- P5.2 repair: when migration 20260717160000 ran without pgvector binaries,
-- CREATE EXTENSION was swallowed and SearchIndexVector was never created.
-- This migration is non-destructive and idempotent (IF NOT EXISTS only).
-- Do not modify 20260717160000.

DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension unavailable in repair migration: %', SQLERRM;
  END;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
    CREATE TABLE IF NOT EXISTS "SearchIndexVector" (
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

    CREATE UNIQUE INDEX IF NOT EXISTS "SearchIndexVector_searchIndexGenerationId_chunkId_provide_key"
      ON "SearchIndexVector"("searchIndexGenerationId", "chunkId", "provider", "model");

    CREATE INDEX IF NOT EXISTS "SearchIndexVector_searchIndexGenerationId_idx"
      ON "SearchIndexVector"("searchIndexGenerationId");

    CREATE INDEX IF NOT EXISTS "SearchIndexVector_chunkId_idx"
      ON "SearchIndexVector"("chunkId");

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'SearchIndexVector_searchIndexGenerationId_fkey'
    ) THEN
      ALTER TABLE "SearchIndexVector"
        ADD CONSTRAINT "SearchIndexVector_searchIndexGenerationId_fkey"
        FOREIGN KEY ("searchIndexGenerationId") REFERENCES "SearchIndexGeneration"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    -- Generic HNSW on typmod-less vector (best-effort).
    BEGIN
      EXECUTE 'CREATE INDEX IF NOT EXISTS "SearchIndexVector_vector_hnsw_idx" ON "SearchIndexVector" USING hnsw ("vector" vector_cosine_ops)';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'HNSW vector index unavailable in repair migration, trying ivfflat: %', SQLERRM;
      BEGIN
        EXECUTE 'CREATE INDEX IF NOT EXISTS "SearchIndexVector_vector_ivfflat_idx" ON "SearchIndexVector" USING ivfflat ("vector" vector_cosine_ops)';
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'ivfflat vector index unavailable in repair migration: %', SQLERRM;
      END;
    END;

    -- Local E5 384-dim expression/partial index (matches search SQL cast).
    BEGIN
      EXECUTE $idx$
        CREATE INDEX IF NOT EXISTS "SearchIndexVector_local_e5_384_hnsw_idx"
        ON "SearchIndexVector"
        USING hnsw (("vector"::vector(384)) vector_cosine_ops)
        WHERE
          "provider" = 'local-e5'
          AND "model" = 'dragonkue/multilingual-e5-small-ko-v2'
          AND "dimension" = 384
      $idx$;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'local-e5 384 HNSW expression index unavailable: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'pgvector type "vector" not found — SearchIndexVector repair skipped.';
  END IF;
END $$;
