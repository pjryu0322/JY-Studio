# ZIP → Python Worker → Store Import

## Source-of-truth rule

Python Worker produces chunks and embedding vectors as local output only.
Store validates worker output, stores artifacts, imports chunks/embeddings, and
performs DB/vector-index reflection. Python Worker must not write Store DB or
Object Storage.

Store / TypeScript Worker:

1. Stores the original ZIP in Object Storage
2. Materializes the ZIP locally and runs the Python Worker CLI
3. Validates worker output JSON contracts
4. Uploads worker-output to Object Storage
5. Imports `chunks.json` / `embeddings.json` / `source_trace.json` as source of
   truth (no TS re-chunk, no TS re-embed)

## Required worker output files

```text
inventory.json
normalized_documents.json
chunks.json
embeddings.json
source_trace.json
validation_report.json
```

`normalized_documents.md` is optional (human review).

### Python Worker = Knowledge Build Worker

The Python Worker interprets the source, structures data, chunks it, and
generates embedding vectors. Store validates, persists to DB, reflects into
pgvector, and runs review/distribution. Output generation order:

```text
ZIP extract → inventory → parser artifacts → normalized_documents → chunks
→ source_trace → embeddings → validation_report → normalized_documents.md
```

### `embeddings.json`

The Python Worker generates `embeddings.json` (one vector per chunk) right after
`chunks.json`. It is always written — empty array `[]` when there are no chunks
or on a failure branch — so the required output contract holds. The Worker
self-checks `len(embeddings) == len(chunks)`; a mismatch marks the run `failed`
and is recorded in `validation_report.errors`.

Modes: `local_e5` (production / default, local CPU E5 via `sentence-transformers`)
and `deterministic_stub` (test-only, no model download). `local_e5` **requires a
local model directory** (`options.embedding.modelPath` or
`JYKSTORE_PYTHON_WORKER_E5_MODEL_PATH`) and never auto-downloads — a missing,
non-existent, or non-directory path fails with a clear `EmbeddingError`
(`local_files_only=True`). The Worker never calls an external API and never
writes Store DB or Object Storage.

An **E5 512-token gate** (same conservative `ceil(len/4)` estimate as Store) is
applied in both modes; over-limit passages fail embedding generation.

`contentHash` is byte-compatible with Store `computeChunkContentHash`
(`title / content / section / sorted(tags)`; `keywords` / `symbols` excluded),
so Store stale detection stays aligned. `embeddingTextHash` covers the actual
E5 passage input text. `validation_report.json` carries `totals.embeddings` and
an `embedding` summary block (mode / provider / model / dimension / status /
embeddedChunks / missingEmbeddings / tokenLimitExceeded) — never raw vectors or
the model path.

Validator enforces chunk ↔ embedding integrity:

- every `embedding.chunkId` exists in `chunks.json`
- exactly one embedding per chunk (no duplicates, none missing)
- `dimension` is a finite positive integer; `vector` is a non-empty `number[]` of
  that length with only finite values (no `NaN` / `Infinity`)
- `provider` / `model` / `contentHash` are non-empty

DB persistence (`KnowledgeChunkEmbedding`) and pgvector mirroring happen in the
DB import step below.

## DB import (P3 + P4)

`prepareWorkerOutputImport()` keeps its role: **validate worker output + build a
payload** (`WorkerOutputImportPayload`). DB/vector reflection is a separate
service, `worker-output-db-import-service.ts`:

```ts
importWorkerOutputToStoreDb({
  payload,
  searchIndexGenerationId, // P4: required (vector index is per generation)
  chunkGenerationId?,      // optional; resolved from the generation if omitted
  sourceDocumentIdByPath?,
  prismaClient?,
  requirePgvector?,        // true → pgvector must be available (hard fail)
  upsertVector?,           // injectable for tests
});
```

From P4, **worker output DB import is always bound to a `SearchIndexGeneration`.**

Behavior:

- Re-asserts import safety before any write: `validationReport.status === "ok"`,
  `errors.length === 0`, `chunks.length === embeddings.length`, and every
  `embedding.chunkId` present in `chunks`. `failed` / `partial` reports are
  rejected (partial is conservative — deferred to a later policy decision).
- Inside the transaction it loads the `SearchIndexGeneration` first and validates:
  - the generation exists (`SEARCH_GENERATION_NOT_FOUND`),
  - it is a current DRAFT still open for import: `scope === "DRAFT"`
    (`SEARCH_GENERATION_NOT_CURRENT`) and `status ∈ {PENDING, EMBEDDING, INDEXING}`
    (`SEARCH_GENERATION_NOT_READY`),
  - `generation.versionId === payload.packVersionId` (`SEARCH_GENERATION_MISMATCH`),
  - a provided `chunkGenerationId` equals `generation.chunkGenerationId`, otherwise
    the generation's value is used as the **resolved** `chunkGenerationId`
    (`CHUNK_GENERATION_REQUIRED` if neither is available),
  - every embedding's `provider` / `model` / `dimension` (and `modelRevision`
    when present) match the generation descriptor
    (`SEARCH_GENERATION_DESCRIPTOR_MISMATCH`).
- Persists each `chunks.json` entry as a `KnowledgeChunk`
  (`chunkType = WORKER_RETRIEVAL_CHUNK`, `versionId = payload.packVersionId`,
  `chunkGenerationId = resolved`, `tags = chunk.tags ?? chunk.keywords ?? []`,
  `sourceDocumentId` from `sourceDocumentIdByPath[sourcePath]` or `null`, Worker
  provenance in `metadata`; `metadata.indexGenerationId` mirrors the resolved
  `chunkGenerationId` for legacy dual-read).
- Persists each `embeddings.json` entry as a `KnowledgeChunkEmbedding` using the
  **newly created `KnowledgeChunk.id`** (not the Worker `chunkId`), carrying
  `provider / model / dimension / vector / contentHash` and
  `searchIndexGenerationId`.
- Mirrors each Worker vector into `SearchIndexVector` (pgvector) via
  `upsertSearchIndexVector()` — **Store owns all pgvector writes; the Python
  Worker never touches pgvector.** `requirePgvector=true` forces
  `JYKSTORE_REQUIRE_PGVECTOR=true`, so an unavailable pgvector hard-fails per
  `search-vector-runtime.ts`; otherwise dev/test falls back to JSON-only and
  records `vectorSkippedCount` + `vectorSyncWarning`.
- Runs chunk + embedding + vector writes in **one transaction** — any failure
  rolls back the whole import.
- Re-run policy: first deletes the generation's existing `SearchIndexVector`
  rows via `deleteSearchIndexVectorsForGeneration()` (KnowledgeChunk deletion
  does not cascade to pgvector — no chunk FK), then deletes existing chunks for
  the **resolved `chunkGenerationId`** (cascade removes their embeddings); other
  generations are untouched. Count fields on the `SearchIndexGeneration` are
  refreshed (`chunkCount` / `embeddedCount` / `failedCount = 0`); status
  transitions stay with the search-data state machine.

`assertSearchGenerationCounts()` now counts both `DOCLING_RETRIEVAL_CHUNK` and
`WORKER_RETRIEVAL_CHUNK` types, so a Worker-imported generation can pass READY
verification.

Implemented in this step:

```text
validated worker output → KnowledgeChunk
embeddings.json → KnowledgeChunkEmbedding
KnowledgeChunkEmbedding.vector → SearchIndexVector (pgvector, Store-only)
```

Remaining:

```text
SearchIndexGeneration + NormalizedDocument creation for the ZIP path (needs a
  schema decision: ND currently requires a DoclingImportBundle FK) — deferred (P5.x)
ZIP upload API / job loop end-to-end (needs a ZIP job/session model) — deferred
provider / admin UX
```

## Orchestration service (P5)

`src/lib/python-worker/worker-zip-pipeline-service.ts` wires the phases above into
one library-level flow, `runWorkerZipImportPipeline(input)`:

```text
store source ZIP → run Python Worker → validate output → store worker output →
bind SearchIndexGeneration → SourceDocument mapping → importWorkerOutputToStoreDb
```

Design notes:

- **Never throws.** Failures are captured in `result.error` with a `retryable`
  hint and the `logicalStage` where they occurred. The temp working dir is always
  cleaned up (`finally`).
- **Ordering (P5.1).** The `SearchIndexGeneration` binding is checked *before*
  `ensureSourceDocuments`, so a missing/unresolved generation fails with
  `SEARCH_GENERATION_REQUIRED` without persisting any `SourceDocument` rows.
- **Stage tracking = completion (P5.1).** `markStage` records a stage only after
  its work succeeds (so a failed step never appears as a completed stage in job/run
  metadata). `WORKER_RUNNING` is the single in-progress exception, recorded right
  before the worker runs.
- **Upload size guards (P5.1).** The source ZIP and each worker output file are
  still read fully into memory (`readFileBytes` + `putSmallObject`), so oversized
  files are rejected (via an injectable `getFileSize`) *before* they are read:
  `maxSourceZipUploadBytes` (default 200MB) → `WORKER_ZIP_FILE_TOO_LARGE`,
  `maxWorkerOutputUploadBytes` (default 100MB) → `WORKER_OUTPUT_FILE_TOO_LARGE`
  (both non-retryable). Streaming/multipart upload is deferred to P5.2 (decided
  before the HTTP route/job wiring).
- **Fully injectable.** `runWorker` / `prepareImport` / `importToDb` / `storage` /
  `readFileBytes` / `makeTempDir` / `cleanupDir` / `ensureSourceDocuments` /
  `resolveSearchIndexGenerationId` are all overridable via `input.deps`, so the
  service is unit-testable without Python / pgvector / Object Storage / a real DB.
- **Boundaries preserved.** Worker output is imported as-is (no TS re-chunk /
  re-embed); `docling-nd-knowledge-builder` is never called.
- **Generation binding, not creation.** The service binds to an existing
  `searchIndexGenerationId` (or one returned by an injected resolver). It never
  invents a generation — actual `SearchIndexGeneration` / `NormalizedDocument`
  creation (and the ND↔bundle schema change) is deferred to P5.x. Missing binding →
  non-retryable `SEARCH_GENERATION_REQUIRED`.
- **SourceDocument mapping.** `ensureWorkerSourceDocuments` (in
  `worker-source-document-service.ts`) creates/reuses one `SourceDocument` per
  normalized document (`legacySourceType = WORKER_ZIP_SOURCE`, idempotent by
  checksum→fileName) and returns the `sourcePath → SourceDocument.id` map consumed
  by `importWorkerOutputToStoreDb`.

Error classification (`classifyWorkerZipError`):

```text
retryable   : WORKER_RUN_TIMEOUT, PAYLOAD_STORAGE_UNAVAILABLE,
              SEARCH_RUNTIME_UNAVAILABLE, LOCK_CONFLICT
non-retryable: WorkerOutputDbImportError.*, WORKER_RUN_FAILED,
              VALIDATION_REPORT_NOT_OK, WORKER_OUTPUT_INVALID,
              MISSING_REQUIRED_OUTPUT, SEARCH_GENERATION_REQUIRED,
              WORKER_ZIP_FILE_TOO_LARGE, WORKER_OUTPUT_FILE_TOO_LARGE
```

Deferred to a later slice: the HTTP ZIP-upload route and the async job model that
drives this service, plus generation/ND creation (see Remaining above).

## Phase 1 audit (overlap)

| Path | Role today | ZIP Worker path |
|------|------------|-----------------|
| `docling-import-service.ts` | 3-file Docling JSON/MD upload → ND | **Legacy** (`legacy_docling_upload` / `manual_docling_import`) |
| `docling-nd-knowledge-builder.ts` | Builds KU/retrieval chunks from ND | **Must not be called** on ZIP Worker import |
| Python `parse_archive.py` | ZIP → inventory / ND / chunks / traces / report | Structure engine (local output only) |
| New `src/lib/python-worker/**` | Validate + import + CLI runner + object keys | **Worker ZIP import** (`worker_zip_import`) |

## Object key layout

```text
{prefix}/packs/{packId}/versions/{packVersionId}/runs/{pipelineRunId}/
├─ source/original.zip
├─ worker-output/...
└─ exports/rag-export.zip
```

## Pipeline status mapping (no schema change)

Logical ZIP stages map onto existing `PipelineStatus` values. See
`src/lib/python-worker/worker-zip-pipeline-stages.ts`.

## Remaining work (out of this slice)

- `SearchIndexGeneration` + `NormalizedDocument` creation for the ZIP path (P5.x;
  needs the ND↔`DoclingImportBundle` schema decision) — the orchestration service
  currently binds to an existing generation / injected resolver
- Full generation status-transition automation (embedding → indexing → ready) on
  import; the service reports counts and leaves transitions to the caller
- HTTP ZIP-upload route (`multipart/form-data`) + async job model that drives
  `runWorkerZipImportPipeline`
- P5.2: decide streaming/multipart upload for the source ZIP / worker output
  (P5.1 only added in-memory size guards) before the route/job wiring
- Index / provider confirm / admin approve UX
- Optional: add dedicated `PipelineStatus` enums if product wants 1:1 stage names
