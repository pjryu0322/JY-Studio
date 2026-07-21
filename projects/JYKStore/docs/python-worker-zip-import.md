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
- Re-run policy: always deletes existing chunks for the **resolved
  `chunkGenerationId`** first (cascade removes their embeddings); other
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
SearchIndexGeneration creation + full status transition automation
Stale SearchIndexVector cleanup across re-runs (no by-generation delete helper yet)
ZIP upload API / job loop end-to-end
provider / admin UX
```

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

- `SearchIndexGeneration` creation + full status transition automation on import
- Stale `SearchIndexVector` cleanup across re-runs (needs a by-generation delete helper)
- Wire provider ZIP upload API / job table end-to-end
- Index / provider confirm / admin approve UX
- Optional: add dedicated `PipelineStatus` enums if product wants 1:1 stage names
