/**
 * Transaction / state-boundary audit for Provider Worker ZIP import orchestration.
 *
 * This folder does NOT open one spanning Prisma interactive transaction. Boundaries:
 *
 * 1. PipelineRun create (RUNNING) — single write before the Worker pipeline starts.
 * 2. Generation id is pre-allocated (UUID). The generation row is created later
 *    inside `synthesizeWorkerZipSearchGeneration` ($transaction): bundle +
 *    NormalizedDocument + SearchIndexGeneration (PENDING DRAFT), and prior active
 *    DRAFTs are retired (stale-at-creation) as required by the partial unique index.
 * 3. Worker output DB import (`importWorkerOutputToStoreDb`, inside the pipeline)
 *    runs in ONE interactive transaction with write order:
 *      delete generation vectors → delete chunks (cascade embeddings) →
 *      createMany chunks → createMany embeddings → batch upsert SearchIndexVector.
 *    Failure rolls back chunk/embedding/vector writes for that generation.
 *    Idempotency: re-run clears this generation's rows then rewrites (other
 *    generations untouched). Inventory provenance is stamped on chunks via
 *    `inventoryItemIdByPath` / `inventoryId` forwarded into the pipeline.
 * 4. Generation outcome updates (toEmbedding → toIndexing → toReady, or toFailed)
 *    are separate writes outside the DB-import transaction. Import data can exist
 *    while generationReady remains false (GENERATION_READY_DEFERRED).
 * 5. PipelineRun PASS/FAIL + step-log finalize are best-effort updates after the
 *    pipeline returns (`.catch(() => undefined)` on run status).
 *
 * Partial failure states (preserved by fail/finalize helpers):
 * - Pipeline !ok, generation never created → FAIL run, no generation id in DTO.
 * - Pipeline !ok, generation created → toFailed + FAIL run + mapped error.
 * - Pipeline ok, READY transition throws → FAIL run, counts preserved, RETRY.
 * - READY + successor reset error → logged only; import still proceeds to quality.
 * - READY + quality refresh fail → ok=false, QUALITY_REFRESH_FAILED, RETRY
 *   (generation already READY; PipelineRun already PASS).
 */
export {};
