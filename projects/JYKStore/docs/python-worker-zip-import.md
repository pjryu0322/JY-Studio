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
- **Early fail (P6 §3).** When neither `input.searchIndexGenerationId` nor
  `deps.resolveSearchIndexGenerationId` is present, the pipeline cannot possibly
  obtain a generation, so it fails immediately at `ACCEPTED` — before storing the
  ZIP, running the worker, storing output, creating SourceDocuments, or importing
  (`SEARCH_GENERATION_REQUIRED`, non-retryable, no temp dir created). When a
  resolver *is* present the normal flow runs, because the resolver may need the
  worker output payload before it can resolve.
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

### P7.2: orchestration split (behavior-preserving)

Ahead of async-job / multipart / retry work, `runWorkerZipImportPipeline()` was
reduced to a thin orchestrator (approx CC 29 → 5) by extracting each numbered step
into a small private helper that shares a mutable `WorkerZipPipelineContext`:

```text
buildPipelineContext        base result / keys / deps / size limits (no side-effects)
validateGenerationBinding   P6 §3 early-fail (no temp dir / storage / worker / import)
markStageCompleted          completion-only stage tracking (WORKER_RUNNING exception)
storeSourceArchive          size guard → store source ZIP → ARCHIVE_STORED
runPythonWorker             temp dir → WORKER_RUNNING → run → WORKER_OUTPUT_CREATED
prepareAndValidateWorkerOutput  validate output → WORKER_OUTPUT_VALIDATED
storeWorkerOutput           per-file size guard → store → WORKER_OUTPUT_STORED
resolveGenerationBinding    bind existing/resolved generation (before any DB write)
persistSourceDocuments      SourceDocument mapping (only after binding)
importWorkerResult          importToDb → IMPORTED
buildPipelineSuccessResult  INDEXING + success shape
handlePipelineFailure       catch → failure shape (preserves attempted stage)
cleanupPipelineTempFiles    finally → best-effort temp cleanup (no-op on early-fail)
```

No behavior change: side-effect order, early-fail (no side-effects), size-guard
ordering (before `readFileBytes`), the `WORKER_RUNNING` in-progress exception, and
the public success/failure result shape are all identical and covered by the
existing `worker-zip-pipeline-service` tests.

> `search-generation-backfill.ts:backfillSearchGenerations` (approx CC 62) is a
> legacy/backfill path unrelated to the ZIP Worker user-test flow. It is
> intentionally **out of scope** here (a large decompose would carry regression
> risk) and is recorded as a legacy/backfill allowlist candidate for a separate
> P8.x / maintenance task.

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

## P6 UX terminology ↔ internal stages

The Provider/Admin screens use business-language step names and never expose
"Python Worker", "SearchIndexGeneration", or "pgvector". These screens already
exist; the mapping below is the source of truth for wording. User-facing state is
derived by the existing pure helpers (do **not** re-derive state in components):

| Provider step (UI) | tab id | internal source of truth |
| --- | --- | --- |
| 기본정보 | `basic` | Pack / PackVersion basic fields |
| 자료 등록 | `payload` | Object Storage upload / SourceDocument exists |
| 데이터 구조화 | `knowledge` | worker run + output validated/imported (`WORKER_RUNNING` → `WORKER_OUTPUT_STORED`); triggered by `POST .../worker-zip` (P7, synchronous) |
| 검색데이터 생성·검증 | `serviceValidation` | `SearchIndexGeneration` / `SearchIndexVector` + retrieval validation |
| 유통정보·검수요청 | `distributionReview` | distribution metadata + review readiness |

Reused helpers (no new parallel abstractions):

```text
resolveProviderRegistrationReadiness  → tab locks / step status / submit blockers
buildProviderSubmitReadinessPlan      → review-request checklist (quality gates)
buildProviderInspectionReadiness      → user-facing titles / CTAs / next action
mapSearchDataFailureCode              → safe user-facing error copy (no stack traces)
admin-review-tabs.ts / admin-review-decision.ts → admin 접수/근거 tabs + 판단 actions
worker-zip-pipeline-stages.ts         → logical stage → PipelineStatus (no schema change)
```

Error copy policy: internal codes such as `SEARCH_GENERATION_REQUIRED` surface to
providers as a "검색데이터 준비 정보 없음 → 다시 시도 / 관리자 문의" message via
`mapSearchDataFailureCode`; raw errors/stack traces stay in the collapsed
operator log. "RAG Export" (search/RAG package) and original-document download are
labeled distinctly (`PackDownloadInfoSection` / `PackPrimaryActions`).

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

## P7: ZIP upload route + generation bridge (synchronous minimal connection)

The provider "데이터 구조화 시작" action now runs end-to-end.

Flow:

```text
POST /api/v1/provider/packs/{packId}/worker-zip  (multipart/form-data, field: file)
  → route: auth + .zip/size validation → spill to temp file (withTempFileFromStream)
  → runProviderWorkerZipImport() [awaited synchronously]
      → ownership + DRAFT check → create PipelineRun
      → runWorkerZipImportPipeline({ deps.resolveSearchIndexGenerationId })
          (resolver runs AFTER worker output is validated/stored)
          → synthesizeWorkerZipSearchGeneration()  ← compatibility bridge
          → importWorkerOutputToStoreDb() (chunks + embeddings + pgvector)
      → transition generation PENDING → EMBEDDING → INDEXING → READY
      → PipelineRun PASS/FAIL
  → 200 (ok) / 422 (processed-but-failed) with a safe DTO
```

### SearchIndexGeneration compatibility bridge (`worker-zip-generation-bridge.ts`)

`SearchIndexGeneration.normalizedDocumentId` (FK) → `NormalizedDocument.bundleId`
(FK) → `DoclingImportBundle` are required. To create a generation **without a
schema change**, the ZIP path synthesizes the *minimum* bundle + normalized
document. This is a **compatibility bridge — not** a return to the Docling
pipeline:

- Rows are tagged `adapterType = "WORKER_ZIP"` (`WORKER_ZIP_ADAPTER_TYPE`) and
  `stagingReason / normalizationReport / structureSummaryJson = worker_zip_bridge`.
- Rows are hidden from Docling flows: `isActive = false` (skips active-bundle /
  active-ND queries) and `deletedAt` set (skips
  `findLatestStagingBundleForVersion`).
- The embedding descriptor is derived from the Worker's own `embeddings.json`
  (`deriveWorkerZipEmbeddingDescriptor`) so `importWorkerOutputToStoreDb`'s
  descriptor check agrees. **No TS re-chunk / re-embed.**
- Generation creation stays in the route/service layer; the pipeline core never
  invents a generation. The service pre-generates the id so a post-creation
  failure can still be marked `FAILED`.

### Role separation vs. legacy Docling import

| Concern | Legacy Docling import | ZIP Worker path (P7) |
| --- | --- | --- |
| Client call | `startProviderDoclingUpload...` | `startProviderWorkerZipImportApi` |
| Route | `.../docling-import/...` | `.../worker-zip` |
| Service | `docling-upload-session-service.ts` | `worker-zip-import-provider-service.ts` |
| Bundle/ND `adapterType` | `DOCLING` | `WORKER_ZIP` (hidden, bridge-only) |
| UI | `ProviderDoclingImportTab` | `ProviderWorkerZipImportCard` |

## P7.1: stabilization + legacy isolation

### Draft generation handling (current schema limits)

The DB enforces **one active DRAFT generation per version** via the partial
unique index `SearchIndexGeneration_one_active_draft_per_version`
(`scope = 'DRAFT' AND status IN ('PENDING','EMBEDDING','INDEXING','READY')`).
Two active DRAFTs for the same version cannot coexist.

- `createSearchGenerationForPipeline({ stalePreviousDrafts })` — option kept,
  default `true`. All callers (Docling + ZIP Worker bridge) use the default, so a
  prior active DRAFT is **staled at generation-creation time** as the new one is
  inserted (required by the unique index).
- Consequence (P7.1.1 hotfix): a new ZIP run stales the existing active DRAFT at
  **start**. Automatically preserving an existing READY DRAFT when the new run
  later fails is **not supported under the current schema**.
- Future (P7.2/P8), to enable true deferred-stale:
  - add a `BUILDING` scope/status to `SearchIndexGeneration`, or
  - redesign the active-unique index alongside nullable `normalizedDocumentId`, or
  - separate the draft *build* generation from the *review-ready* generation.

### READY-transition failure is not "완료"

Import can succeed while the generation fails to reach READY. That is **not** a
completed structuring:

- `runProviderWorkerZipImport` returns `ok: false`, `nextStep: "RETRY"`,
  `generationReady: false`, `error.code: "GENERATION_READY_DEFERRED"`,
  `supportRequired: true`, and **preserves** `importedChunkCount /
  importedEmbeddingCount` for diagnostics.
- `PipelineRun` is recorded as `FAIL` (a valid `PipelineStepStatus`; never
  `WARNING`/`PASS`).
- `ProviderWorkerZipImportCard` shows "완료" **only** when
  `result.ok && result.generationReady === true`; the deferred case renders
  "데이터는 생성됐지만 검색데이터 준비가 지연되었습니다" + 관리자 문의 / 다시 실행.
  Internal terms (Python Worker / pgvector / SearchIndexGeneration) are never
  surfaced.

### Content-length pre-parse size guard

`worker-zip-route-helpers.ts` (pure, unit tested):

- `checkWorkerZipContentLength(header)` rejects with `413` **before**
  `request.formData()` parses an oversized body. Missing/invalid headers fall
  through to the post-parse `validateWorkerZipFile` (`file.size`) guard.
- `mapWorkerZipImportHttpResponse(result)` → `200` (ok) / `422` (processed-but-failed).
- Large multipart streaming / upload sessions remain deferred to **P5.2/P7.2**.

### Legacy Docling isolation (tested)

- Bridge rows set `adapterType = WORKER_ZIP`, `isActive = false`, `deletedAt`
  set, `stagingReason = worker_zip_bridge`, and ND
  `structureSummaryJson.source = worker_zip_bridge`.
- `isStagingVisibleDoclingBundle(bundle)` (exported from
  `docling-import-lifecycle-service.ts`) mirrors the
  `findLatestStagingBundleForVersion` where-clause; a bridge row returns
  `false`, so it never appears as a Docling staging bundle.
- Import-boundary tests: the bridge does not import
  `docling-nd-knowledge-builder`; the provider service does not import the legacy
  `docling-upload-session-service`; `ProviderDoclingImportTab` does not call the
  worker-zip API.

### Deferred to P7.2 (async job model)

This round is still a **synchronous minimal connection**: the route `await`s the
service directly. Deferred:

- Async job handoff — enqueue a `PENDING` run and let a poll worker claim/process
  it (mirroring `search-data-generation-worker.ts`), returning `202 Accepted`
  with a status endpoint instead of blocking the request.
- Streaming/multipart upload for large ZIPs (P5.2) — the route still rejects
  oversized files (413) rather than streaming them.
- Schema change to make `SearchIndexGeneration.normalizedDocumentId` nullable so
  the synthesized bundle/ND bridge can be removed.

## Remaining work (out of this slice)

- P7.2: async job model + `202 Accepted` + status polling (see above)
- P5.2: streaming/multipart upload for the source ZIP / worker output
- **Schema change to drop the bridge**: make
  `SearchIndexGeneration.normalizedDocumentId` nullable, then remove the
  synthesized `DoclingImportBundle` + `NormalizedDocument` compatibility bridge
- Optional: add dedicated `PipelineStatus` enums if product wants 1:1 stage names
