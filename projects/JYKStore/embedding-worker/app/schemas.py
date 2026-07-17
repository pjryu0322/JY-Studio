from __future__ import annotations

from pydantic import BaseModel, Field


class EmbedRequest(BaseModel):
    model: str
    texts: list[str] = Field(min_length=1)
    normalize: bool = True


class ReadyResponse(BaseModel):
    ready: bool
    backend: str
    stub: bool
    model: str
    revision: str
    dimension: int
    maxSequenceTokens: int
    normalized: bool
    device: str


class EmbedResponse(BaseModel):
    model: str
    revision: str
    dimension: int
    vectors: list[list[float]]
