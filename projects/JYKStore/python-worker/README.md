# JYKStore Python Worker

Independent CLI worker that turns a product document/sample ZIP into Store-ready structured artifacts.

This worker does **not** connect to the Store DB, call embedding APIs, or modify Next.js/Prisma code.

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
| `local_e5` | production / **default** | Local CPU E5 via `sentence-transformers`, offline model files |
| `deterministic_stub` | **test only** | Reproducible hash-based vectors, no model download |

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
over title / section / keywords / content). `contentHash` is over the chunk's own
content fields; `embeddingTextHash` is over the actual embedding input text.

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

