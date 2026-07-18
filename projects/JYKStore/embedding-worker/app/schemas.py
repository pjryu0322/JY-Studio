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
    modelSource: str = "stub"
    offline: bool = False
    maxBatchSize: int = 32


class EmbedResponse(BaseModel):
    model: str
    revision: str
    dimension: int
    vectors: list[list[float]]


class TokenizeRequest(BaseModel):
    model: str
    texts: list[str] = Field(min_length=1)


class TokenizeItem(BaseModel):
    index: int
    tokenCount: int
    withinLimit: bool


class TokenizeResponse(BaseModel):
    model: str
    revision: str
    maxSequenceTokens: int
    items: list[TokenizeItem]
