# JYKStore E5 CPU Embedding Worker

Local CPU worker for `dragonkue/multilingual-e5-small-ko-v2` (384-dim, cosine via L2-normalized vectors).

## Endpoints

- `GET /health` — process up
- `GET /ready` — model loaded
- `POST /embed/query` — `query:` prefixed search strings
- `POST /embed/passages` — `passage:` prefixed chunk strings

## Development (stub, no model download)

```bash
cd embedding-worker
set E5_WORKER_STUB=true
python -m uvicorn app.main:app --host 127.0.0.1 --port 8010
```

Point JYKStore at `JYKSTORE_EMBEDDING_WORKER_URL=http://127.0.0.1:8010`.

## Production

Install dependencies, leave `E5_WORKER_STUB` unset/false, mount a Hugging Face cache volume at `HF_HOME`.

```bash
docker build -t jykstore-embedding-worker .
docker run -p 8000:8000 -v e5-model-cache:/model-cache jykstore-embedding-worker
```

## Tests

```bash
cd embedding-worker
set E5_WORKER_STUB=true
python -m pytest
```
