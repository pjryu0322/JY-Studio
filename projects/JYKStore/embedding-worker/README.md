# JYKStore E5 CPU Embedding Worker

Local CPU worker for `dragonkue/multilingual-e5-small-ko-v2` (384-dim, cosine via L2-normalized
vectors). Serves the JYKStore `local-e5` embedding provider. **No external / paid APIs.**

> INTERNAL SERVICE ONLY. This worker must run on a private Docker network reachable only by the
> JYKStore server. Do **not** connect it to a reverse-proxy public route or expose a public host
> port. All embedding endpoints require an internal bearer token.

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
  "device": "cpu"
}
```

The JYKStore Node adapter verifies `ready`, `stub=false`, `backend`, `model`, `revision`,
`dimension`, `normalized`, and `device` before every embedding operation.

## Configuration

| Env                    | Default                                   | Notes                                        |
| ---------------------- | ----------------------------------------- | -------------------------------------------- |
| `E5_WORKER_ENV`        | `development`                             | `development` / `test` / `production`        |
| `E5_WORKER_STUB`       | `false`                                   | **must be `false` in production** (startup fails) |
| `E5_MODEL_ID`          | `dragonkue/multilingual-e5-small-ko-v2`   |                                              |
| `E5_MODEL_REVISION`    | (empty)                                   | **40-char HF commit SHA** — required for all live (non-stub) runs |
| `E5_WORKER_TOKEN`      | (empty)                                   | internal bearer token — **required in production**; constant-time compare |
| `E5_MAX_BATCH_SIZE`    | `32`                                       | per-request text cap                         |
| `E5_MAX_TEXT_BYTES`    | `20000`                                    | per-text byte cap                            |
| `E5_MAX_REQUEST_BYTES` | `300000`                                   | whole-request byte cap                       |
| `E5_MAX_CONCURRENCY`   | `1`                                        | one embedding job at a time (429/503 + Retry-After when busy) |
| `HF_HOME`              | `/model-cache`                             | model cache volume (download once, offline restart) |

## Policies

- **Operational stub is forbidden.** Stub mode is only for unit / contract tests and dev mocks —
  never for real pipeline, review, approval, or distribution evidence. Production startup fails if
  `E5_WORKER_STUB=true`.
- **512-token limit is authoritative via the model tokenizer.** Over-limit inputs return HTTP 400
  `EMBEDDING_TOKEN_LIMIT_EXCEEDED` (index + tokenCount + maxSequenceTokens only, never the raw
  text). No silent truncation.
- **Fixed revision.** Model + tokenizer load a pinned commit SHA; `/ready` reports the loaded
  revision. Model files are never committed to git.
- **Never log** full vectors, request text, or auth tokens.

## Run — stub (no model download)

PowerShell:

```powershell
$env:E5_WORKER_ENV="development"; $env:E5_WORKER_STUB="true"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8010
```

Or from the repo root: `npm run dev:embedding-worker` (serves the stub on port 8010).
Point JYKStore at `JYKSTORE_EMBEDDING_WORKER_URL=http://127.0.0.1:8010`.

## Run — real model

PowerShell:

```powershell
$env:E5_WORKER_ENV="development"; $env:E5_WORKER_STUB="false"
$env:E5_MODEL_REVISION="<commit-sha>"; $env:E5_WORKER_TOKEN="<token>"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## Docker (production)

```bash
docker build -t jykstore-embedding-worker .
docker run --network jykstore-internal \
  -e E5_WORKER_ENV=production -e E5_WORKER_STUB=false \
  -e E5_MODEL_REVISION=<commit-sha> -e E5_WORKER_TOKEN=<token> \
  -v e5-model-cache:/model-cache \
  jykstore-embedding-worker
```

Runs as a non-root user (`appuser`, uid 10001). Do not publish the port to the host in
production; attach it to the internal network only. The image installs from `requirements.lock`.

## Tests

```powershell
# stub contract tests
$env:E5_WORKER_ENV="test"; $env:E5_WORKER_STUB="true"; python -m pytest
# or from repo root:
npm run embedding-worker:test:stub
```

Live smoke tests (real model, relative ranking only — never a hardcoded score):

```powershell
$env:E5_WORKER_STUB="false"; $env:E5_MODEL_REVISION="<commit-sha>"
python -m pytest tests/test_live_smoke.py
# or:
npm run embedding-worker:test:live
```

## Benchmark

```powershell
$env:E5_WORKER_STUB="false"; $env:E5_MODEL_REVISION="<commit-sha>"
python benchmark/run_benchmark.py
# or:
npm run embedding-worker:benchmark:live
```

Record results in `../docs/embedding-worker-benchmark.md`. Do not present estimates as measured.

## Troubleshooting

- **`/ready` 503** — model still loading, or (live) revision/download failed. Check HF cache volume.
- **401 from worker** — `E5_WORKER_TOKEN` mismatch between JYKStore and the worker.
- **Node `EMBEDDING_WORKER_STUB_ACTIVE`** — worker is in stub mode; set `E5_WORKER_STUB=false`.
- **Node `EMBEDDING_MODEL_REVISION_MISMATCH`** — worker revision ≠ generation/DB revision.
- **429 / 503 with Retry-After** — worker busy (concurrency limit); the Node adapter retries with backoff.
