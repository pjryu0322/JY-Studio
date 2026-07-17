from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from app import model as embed_model
from app.schemas import EmbedRequest, EmbedResponse
from app.settings import settings


@asynccontextmanager
async def lifespan(_app: FastAPI):
    embed_model.warmup()
    yield


app = FastAPI(title="JYKStore E5 Embedding Worker", lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready")
def ready() -> dict[str, str]:
    if not embed_model.is_ready():
        raise HTTPException(status_code=503, detail="model not ready")
    return {"status": "ready", "model": settings.model_id, "stub": str(settings.stub_mode)}


def _embed(kind: str, body: EmbedRequest) -> EmbedResponse:
    if body.model != settings.model_id:
        raise HTTPException(status_code=400, detail="model mismatch")
    try:
        vectors = embed_model.embed_texts(body.texts, kind=kind, normalize=body.normalize)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return EmbedResponse(model=settings.model_id, dimension=settings.dimension, vectors=vectors)


@app.post("/embed/query", response_model=EmbedResponse)
def embed_query(body: EmbedRequest) -> EmbedResponse:
    return _embed("query", body)


@app.post("/embed/passages", response_model=EmbedResponse)
def embed_passages(body: EmbedRequest) -> EmbedResponse:
    return _embed("passage", body)
