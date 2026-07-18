# JYKStore E5 CPU Embedding Worker

Local CPU worker for `dragonkue/multilingual-e5-small-ko-v2` (384-dim, cosine via L2-normalized
vectors). Serves the JYKStore `local-e5` embedding provider. **No external / paid APIs.**

> INTERNAL SERVICE ONLY. This worker must run on a private network reachable only by the
> JYKStore server. Do **not** connect it to a reverse-proxy public route or expose a public host
> port. All embedding endpoints require an internal bearer token.

Docker 기반 배포는 현재 JYKStore 작업 범위에 포함되지 않는다.

## Endpoints

| Method | Path              | Auth        | Purpose                              |
| ------ | ----------------- | ----------- | ------------------------------------ |
| GET    | `/health`         | none        | Liveness only (`{"status":"ok"}`)    |
| GET    | `/ready`          | Bearer      | Readiness + model/revision descriptor |
| POST   | `/embed/query`    | Bearer      | `query:`-prefixed search strings     |
| POST   | `/embed/passages` | Bearer      | `passage:`-prefixed chunk strings    |

`/ready` returns:

```json
{
  "ready": true,
  "backend": "sentence-transformers",
  "stub": false,
  "model": "dragonkue/multilingual-e5-small-ko-v2",
  "revision": "<commit-sha>",
  "dimension": 384,
  "maxSequenceTokens": 512,
  "normalized": true,
  "device": "cpu",
  "modelSource": "local-directory",
  "offline": true
}
```

The JYKStore Node adapter verifies `ready`, `stub=false`, `backend`, `model`, `revision`,
`dimension`, `normalized`, and `device` before every embedding operation. Absolute local model
paths are never exposed.

## Configuration

| Env                    | Default                                   | Notes                                        |
| ---------------------- | ----------------------------------------- | -------------------------------------------- |
| `E5_WORKER_ENV`        | `development`                             | `development` / `test` / `production`        |
| `E5_WORKER_STUB`       | `false`                                   | **must be `false` in production** (startup fails) |
| `E5_MODEL_ID`          | `dragonkue/multilingual-e5-small-ko-v2`   |                                              |
| `E5_MODEL_REVISION`    | (empty)                                   | **Required** — 40-char lowercase HF commit SHA. No `latest` / branch / tag auto-resolve. |
| `E5_MODEL_DIR`         | (empty)                                   | **Required** for install and live worker — absolute path to the installed revision directory |
| `E5_MODEL_OFFLINE`     | `false`                                   | Live worker must set `true` (no Hub download at startup) |
| `E5_WORKER_TOKEN`      | (empty)                                   | internal bearer token — **required in production**; constant-time compare |
| `E5_MAX_BATCH_SIZE`    | `32`                                       | per-request text cap                         |
| `E5_MAX_TEXT_BYTES`    | `20000`                                    | per-text byte cap                            |
| `E5_MAX_REQUEST_BYTES` | `300000`                                   | whole-request byte cap                       |
| `E5_MAX_CONCURRENCY`   | `1`                                        | one embedding job at a time (429/503 + Retry-After when busy) |

## Policies

- **Operational stub is forbidden.** Stub mode is only for unit / contract tests and dev mocks —
  never for real pipeline, review, approval, or distribution evidence. Production startup fails if
  `E5_WORKER_STUB=true`.
- **512-token limit is authoritative via the model tokenizer.** Over-limit inputs return HTTP 400
  `EMBEDDING_TOKEN_LIMIT_EXCEEDED` (index + tokenCount + maxSequenceTokens only, never the raw
  text). No silent truncation.
- **Fixed revision.** `E5_MODEL_REVISION` must be a pinned 40-char commit SHA. `latest` / `main` /
  branch / tag auto-selection is forbidden.
- **Install once, reuse forever.** Only `npm run embedding-model:install` may download from Hugging
  Face. The live Worker never downloads and never installs at startup — it loads `E5_MODEL_DIR`
  with `local_files_only=True`.
- **Never log** full vectors, request text, or auth tokens.
- Model binaries and Hugging Face cache are never committed to git.

## Run — stub (no model download)

PowerShell:

```powershell
$env:E5_WORKER_ENV="development"; $env:E5_WORKER_STUB="true"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8010
```

Or from the repo root: `npm run dev:embedding-worker` (serves the stub on port 8010).
Point JYKStore at `JYKSTORE_EMBEDDING_WORKER_URL=http://127.0.0.1:8010`.

## Install model (once)

`E5_MODEL_REVISION` and `E5_MODEL_DIR` are **required**. Omitting either fails with
`E5_MODEL_DIR_REQUIRED` / revision validation errors — there is no default path and no
latest resolve.

```powershell
cd C:\project\JY-Studio\projects\JYKStore

$env:E5_MODEL_ID="dragonkue/multilingual-e5-small-ko-v2"
$env:E5_MODEL_REVISION="<고정된 40자리 Hugging Face Commit SHA>"
$env:E5_MODEL_DIR="C:\JYKStore\models\multilingual-e5-small-ko-v2\$env:E5_MODEL_REVISION"
$env:E5_MODEL_OFFLINE="true"

npm run embedding-model:install
npm run embedding-model:status
npm run embedding-model:verify
```

Re-running install against a complete directory skips download (`INSTALL_SKIP`). Keep reusing the
same installed directory for all subsequent live worker starts.

## Run — live worker (offline)

```powershell
$env:E5_WORKER_ENV="development"; $env:E5_WORKER_STUB="false"
$env:E5_MODEL_ID="dragonkue/multilingual-e5-small-ko-v2"
$env:E5_MODEL_REVISION="<고정된 40자리 Hugging Face Commit SHA>"
$env:E5_MODEL_DIR="C:\JYKStore\models\multilingual-e5-small-ko-v2\$env:E5_MODEL_REVISION"
$env:E5_MODEL_OFFLINE="true"
$env:E5_WORKER_TOKEN="<local-internal-token>"
npm run embedding-worker:start:live
```

Or with uvicorn directly after setting the same env vars:

```powershell
python -m uvicorn app.main:app --host 127.0.0.1 --port 8011
```

Live startup loads **only** `E5_MODEL_DIR` with `local_files_only=True`. It does not call
`snapshot_download` or Hub `model_info`.

## Tests

```powershell
# stub contract tests
$env:E5_WORKER_ENV="test"; $env:E5_WORKER_STUB="true"; python -m pytest
# or from repo root:
npm run embedding-worker:test:stub
```

Live smoke tests (real model, relative ranking only — never a hardcoded score):

```powershell
$env:E5_WORKER_STUB="false"
$env:E5_MODEL_REVISION="<고정된 40자리 Hugging Face Commit SHA>"
$env:E5_MODEL_DIR="C:\JYKStore\models\multilingual-e5-small-ko-v2\$env:E5_MODEL_REVISION"
$env:E5_MODEL_OFFLINE="true"
python -m pytest tests/test_live_smoke.py
# or:
npm run embedding-worker:test:live
```

## Benchmark

```powershell
$env:E5_WORKER_STUB="false"
$env:E5_MODEL_REVISION="<고정된 40자리 Hugging Face Commit SHA>"
$env:E5_MODEL_DIR="C:\JYKStore\models\multilingual-e5-small-ko-v2\$env:E5_MODEL_REVISION"
$env:E5_MODEL_OFFLINE="true"
python benchmark/run_benchmark.py
# or:
npm run embedding-worker:benchmark:live
```

Record results in `../docs/embedding-worker-benchmark.md`. Do not present estimates as measured.

## Troubleshooting

- **`/ready` 503** — model still loading, or live `E5_MODEL_DIR` / revision validation failed.
- **401 from worker** — `E5_WORKER_TOKEN` mismatch between JYKStore and the worker.
- **Node `EMBEDDING_WORKER_STUB_ACTIVE`** — worker is in stub mode; set `E5_WORKER_STUB=false`.
- **Node `EMBEDDING_MODEL_REVISION_MISMATCH`** — worker revision ≠ generation/DB revision.
- **429 / 503 with Retry-After** — worker busy (concurrency limit); the Node adapter retries with backoff.
- **`E5_MODEL_DIR_REQUIRED`** — set absolute `E5_MODEL_DIR` before install or live start.
