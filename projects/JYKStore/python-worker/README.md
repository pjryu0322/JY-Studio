# JYKStore Python Worker

**Knowledge Build Worker** — an independent CLI that turns a product
document/sample ZIP into Store-ready structured knowledge: it interprets the
source, structures data, chunks it, and generates embedding vectors.

This worker does **not** connect to the Store DB, call external embedding APIs,
write Object Storage, or modify Next.js/Prisma code. Store handles validation,
DB persistence, pgvector reflection, and review/distribution.

Output generation order:

```text
ZIP extract
→ inventory
→ parser artifacts
→ normalized_documents
→ chunks
→ source_trace
→ embeddings
→ validation_report
→ normalized_documents.md
```

## Requirements

- Python 3.11+
- `beautifulsoup4`, `lxml` (required)
- `docling` (optional — PDF parsing; skipped gracefully if missing)

```bash
cd projects/JYKStore/python-worker
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/macOS
# source .venv/bin/activate
pip install -r requirements.txt
```

Optional PDF support:

```bash
pip install docling
```

## CLI

```bash
python parse_archive.py \
  --input "C:/doc/JYKStore/rMateGridH5Web_v6.0_EN_Trial.zip" \
  --output "./output/rmate-grid-v6" \
  --pack-name "rMate Grid" \
  --product-version "v6.0" \
  --language "ko"
```

Options JSON:

```bash
python parse_archive.py --options-json ./options.json --output ./output/rmate-grid-v6
```

Example `options.json`:

```json
{
  "archivePath": "C:/doc/JYKStore/rMateGridH5Web_v6.0_EN_Trial.zip",
  "packName": "rMate Grid",
  "productVersion": "v6.0",
  "language": "ko",
  "options": {
    "parsePdf": true,
    "parseApiHtml": true,
    "parseSamples": true,
    "includeOriginalDownload": false
  }
}
```

## Outputs

Written under `--output`:

| File | Purpose |
|------|---------|
| `inventory.json` | Every archive file with classification / parser |
| `parser_artifacts/**/*.json` | Raw parser results |
| `normalized_documents.json` | Store-shaped documents |
| `normalized_documents.md` | Human review summary |
| `chunks.json` | Embedding-ready chunks |
| `embeddings.json` | One embedding vector per chunk (always generated) |
| `source_trace.json` | Chunk → source traceability |
| `validation_report.json` | Counts, warnings, errors |

Source-of-truth rule: Python Worker produces chunks and embedding vectors as
local output. Store validates worker output, stores artifacts, imports
chunks/embeddings, and performs DB/vector-index reflection. Python Worker must
not write Store DB or Object Storage.

### Embeddings

`embeddings.json` is always written (empty array `[]` when there are no chunks or
on a failure branch) so the required output contract is satisfied. Each entry
matches the Store contract: `chunkId`, `provider`, `model`, `dimension`,
`vector`, `contentHash` (plus optional `embeddingTextHash`, `modelRevision`,
`createdAt`). `NaN` / `Infinity` are never written.

Two modes (via options JSON `options.embedding` or environment):

| Mode | Use | Notes |
|------|-----|-------|
| `local_e5` | production / **default** | Local CPU E5 via `sentence-transformers`. **Requires a local model path** and never auto-downloads |
| `deterministic_stub` | **test only** | Reproducible hash-based vectors, no model download |

`local_e5` requires `options.embedding.modelPath` (or
`JYKSTORE_PYTHON_WORKER_E5_MODEL_PATH`). If the path is missing or does not
exist, the Worker fails with a clear `EmbeddingError` instead of downloading
from the network (`local_files_only=True`). The model name is retained as
descriptor metadata only.

Environment variables:

```text
JYKSTORE_PYTHON_WORKER_EMBEDDING_MODE=local_e5 | deterministic_stub
JYKSTORE_PYTHON_WORKER_E5_MODEL_PATH=<local model path>
JYKSTORE_PYTHON_WORKER_E5_MODEL_NAME=dragonkue/multilingual-e5-small-ko-v2
```

Example `options.json` embedding block:

```json
{
  "options": {
    "embedding": {
      "mode": "local_e5",
      "provider": "local-e5",
      "model": "dragonkue/multilingual-e5-small-ko-v2",
      "modelPath": "C:/models/multilingual-e5-small",
      "dimension": 384
    }
  }
}
```

The embedding input text follows the Store E5 passage policy (`passage: ` prefix
over title / section / tags / content, where `tags` is used when present and
`keywords` otherwise). `contentHash` is byte-compatible with Store
`computeChunkContentHash` (`title / content / section / sorted(tags)`; `keywords`
/ `symbols` are **not** hashed directly), so Store stale detection stays aligned.
`embeddingTextHash` is over the actual embedding input text.

An **E5 512-token gate** (same conservative `ceil(len/4)` estimate as Store) is
applied in both modes; a chunk whose passage exceeds the limit fails embedding
generation. `validation_report.json` summarizes the outcome (no vectors, no model
path) under `totals.embeddings` and an `embedding` block:

```json
{
  "totals": { "documents": 0, "chunks": 0, "embeddings": 0 },
  "embedding": {
    "mode": "local_e5",
    "provider": "local-e5",
    "model": "dragonkue/multilingual-e5-small-ko-v2",
    "dimension": 384,
    "status": "ok | failed | skipped",
    "embeddedChunks": 0,
    "missingEmbeddings": 0,
    "tokenLimitExceeded": 0
  }
}
```

`embeddings.json` is always written (even `[]` on a failure branch); if chunks
exist without matching embeddings the run is marked `failed` and the cause is
recorded in `validation_report.errors`.

DB persistence (`KnowledgeChunkEmbedding`) and pgvector upsert are **later**
steps and are not implemented here.

## Classification (defaults)

- PDF → `knowledge_target` / `docling_pdf`
- `Docs/api/*.html` → `knowledge_target` / `html_api`
- `Samples|React_Vue_Samples|ServerSamples/**/*.html` → `knowledge_target` / `html_sample`
- License/copyright filenames → `review_target`
- Images → `supporting_asset`
- `LicenseKey/**`, `*.min.js`, `fonts/**`, `styles/**`, `dist/**`, `build/**` → `excluded`

## Tests

```bash
pip install -r requirements.txt
python -m unittest discover -s tests -v
```

## Safety

- Zip Slip (`../`, absolute paths) is blocked on both raw and recovered paths
- Per-file and total extract size limits are configurable
- Unsafe entries are recorded in `validation_report.json`, not silently dropped from the report
- Korean ZIP filenames (CP949/EUC-KR) are recovered; `inventory.json` keeps `sourcePath`, `rawSourcePath`, `pathEncoding`, `pathDecoded`
- `parser_artifacts` filenames use safe slug+hash names (e.g. `pdf_001_..._사용설명서_<hash>.json`)

