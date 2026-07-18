-- P5.1: drop the column default so new SearchIndexGeneration rows must explicitly
-- supply embeddingModelRevision (pinned 40-char HF commit SHA).
-- Existing legacy rows retain the backfilled value 'legacy-unknown'.
-- Do NOT edit the prior migration that added the column.
ALTER TABLE "SearchIndexGeneration"
  ALTER COLUMN "embeddingModelRevision" DROP DEFAULT;
