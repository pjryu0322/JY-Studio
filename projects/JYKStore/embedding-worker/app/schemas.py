from __future__ import annotations

from pydantic import BaseModel, Field


class EmbedRequest(BaseModel):
    model: str
    texts: list[str] = Field(min_length=1)
    normalize: bool = True


class EmbedResponse(BaseModel):
    model: str
    dimension: int
    vectors: list[list[float]]
