-- Follow-up migration (do not edit prior migrations): pin the embedding model revision
-- on every SearchIndexGeneration so DB / Worker /ready / Snapshot / Validation stay in lock-step.
--
-- Existing rows predate revision pinning and are backfilled with the explicit compatibility
-- value 'legacy-unknown'. New generations record the real Hugging Face commit SHA
-- (JYKSTORE_EMBEDDING_MODEL_REVISION); production requires a non-empty revision.
ALTER TABLE "SearchIndexGeneration"
  ADD COLUMN "embeddingModelRevision" TEXT NOT NULL DEFAULT 'legacy-unknown';
