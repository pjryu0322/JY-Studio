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

DB persistence (`KnowledgeChunkEmbedding`) and pgvector upsert are a **later**
step and are not implemented here.

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

- Persist imported chunks/embeddings into Store DB / vector-index tables
- Wire provider ZIP upload API / job table end-to-end
- Index / provider confirm / admin approve UX
- Optional: add dedicated `PipelineStatus` enums if product wants 1:1 stage names
