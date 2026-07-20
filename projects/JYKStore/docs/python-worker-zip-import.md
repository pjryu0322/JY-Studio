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

### `embeddings.json` (contract-extension stage)

This stage adds `embeddings.json` to the **contract, validator, import payload,
and Object Storage plan only**. Actual embedding generation in the Python Worker
and DB/vector-index persistence (e.g. `KnowledgeChunkEmbedding`, pgvector) are
later steps.

Validator enforces chunk ↔ embedding integrity:

- every `embedding.chunkId` exists in `chunks.json`
- exactly one embedding per chunk (no duplicates, none missing)
- `dimension` is a positive integer and `vector` is `number[]` of that length
- `provider` / `model` / `contentHash` are non-empty

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

- Generate real embedding vectors in the Python Worker (`embeddings.json`)
- Persist imported chunks/embeddings into Store DB / vector-index tables
- Wire provider ZIP upload API / job table end-to-end
- Index / provider confirm / admin approve UX
- Optional: add dedicated `PipelineStatus` enums if product wants 1:1 stage names
