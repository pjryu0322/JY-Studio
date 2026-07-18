from __future__ import annotations

import asyncio
import hmac
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

from app import model as embed_model
from app.schemas import EmbedRequest, EmbedResponse, ReadyResponse
from app.settings import settings


@asynccontextmanager
async def lifespan(_app: FastAPI):
    embed_model.warmup()
    yield


app = FastAPI(title="JYKStore E5 Embedding Worker", lifespan=lifespan)

# F. Concurrency guard: a single CPU model instance serves one embedding job at a time.
_inflight = 0
_inflight_lock = asyncio.Lock()


class ContentLengthLimitMiddleware(BaseHTTPMiddleware):
    """Reject oversized bodies before full deserialization (Part I)."""

    async def dispatch(self, request: Request, call_next) -> Response:
        content_length = request.headers.get("content-length")
        if content_length is not None:
            try:
                length = int(content_length)
            except ValueError:
                return JSONResponse({"detail": "invalid content-length"}, status_code=400)
            if length > settings.max_request_bytes:
                return JSONResponse({"detail": "request too large"}, status_code=413)
        return await call_next(request)


app.add_middleware(ContentLengthLimitMiddleware)


async def _acquire_slot() -> bool:
    global _inflight
    async with _inflight_lock:
        if _inflight >= settings.max_concurrency:
            return False
        _inflight += 1
        return True


async def _release_slot() -> None:
    global _inflight
    async with _inflight_lock:
        _inflight = max(0, _inflight - 1)


def require_auth(authorization: str | None = Header(default=None)) -> None:
    """Internal bearer auth for /ready and /embed/*. 401/403 are non-retryable.

    Production always requires a token (enforced at Settings.from_env). When a
    token is configured, compare with hmac.compare_digest for constant-time safety.
    """
    if not settings.token:
        # Non-production may omit the token (dev/stub only).
        return
    expected = f"Bearer {settings.token}"
    provided = authorization or ""
    if not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="unauthorized")


@app.get("/health")
def health() -> dict[str, str]:
    # Liveness only — minimal info, no auth.
    return {"status": "ok"}


@app.get("/ready", response_model=ReadyResponse, dependencies=[Depends(require_auth)])
def ready() -> ReadyResponse:
    if not embed_model.is_ready():
        raise HTTPException(status_code=503, detail="model not ready")
    # Return the resolved commit SHA (not merely the configured string).
    revision = embed_model.resolved_revision() or settings.configured_revision
    return ReadyResponse(
        ready=True,
        backend=settings.backend,
        stub=settings.stub_mode,
        model=settings.model_id,
        revision=revision,
        dimension=settings.dimension,
        maxSequenceTokens=settings.max_sequence_tokens,
        normalized=settings.normalize,
        device=embed_model.device(),
        modelSource=embed_model.model_source(),
        offline=embed_model.offline_mode(),
    )


def _validate_request_limits(body: EmbedRequest, raw_len: int) -> None:
    if raw_len > settings.max_request_bytes:
        raise HTTPException(status_code=413, detail="request too large")
    if body.model != settings.model_id:
        raise HTTPException(status_code=400, detail="model mismatch")
    if not body.normalize:
        raise HTTPException(status_code=400, detail="normalize=true is required")
    if len(body.texts) < 1 or len(body.texts) > settings.max_batch_size:
        raise HTTPException(
            status_code=400,
            detail=f"texts count must be between 1 and {settings.max_batch_size}",
        )
    for index, text in enumerate(body.texts):
        if not text or not text.strip():
            raise HTTPException(status_code=400, detail=f"input[{index}] empty text")
        if len(text.encode("utf-8")) > settings.max_text_bytes:
            raise HTTPException(status_code=400, detail=f"input[{index}] text too large")


async def _embed(kind: str, request: Request, body: EmbedRequest) -> EmbedResponse:
    raw = await request.body()
    _validate_request_limits(body, len(raw))

    if not await _acquire_slot():
        raise HTTPException(
            status_code=503,
            detail="worker busy",
            headers={"Retry-After": "1"},
        )
    try:
        vectors = await asyncio.to_thread(
            embed_model.embed_texts, body.texts, kind=kind, normalize=body.normalize
        )
    except embed_model.TokenLimitError as exc:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "EMBEDDING_TOKEN_LIMIT_EXCEEDED",
                "index": exc.index,
                "tokenCount": exc.token_count,
                "maxSequenceTokens": exc.max_tokens,
            },
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    finally:
        await _release_slot()

    return EmbedResponse(
        model=settings.model_id,
        revision=embed_model.resolved_revision() or settings.configured_revision,
        dimension=settings.dimension,
        vectors=vectors,
    )


@app.post("/embed/query", response_model=EmbedResponse, dependencies=[Depends(require_auth)])
async def embed_query(request: Request, body: EmbedRequest) -> EmbedResponse:
    return await _embed("query", request, body)


@app.post("/embed/passages", response_model=EmbedResponse, dependencies=[Depends(require_auth)])
async def embed_passages(request: Request, body: EmbedRequest) -> EmbedResponse:
    return await _embed("passage", request, body)
