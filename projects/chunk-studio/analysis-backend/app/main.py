from fastapi import FastAPI
from .models import PageUnderstandingRequest, PageUnderstandingResponse
from .classifier import (
    build_features,
    confidence_from_scores,
    detect_family,
    resolve_page_type,
    resolve_subtype,
    score_page,
)

app = FastAPI(title="Chunk Studio Analysis Service", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze/page-understanding", response_model=PageUnderstandingResponse)
def analyze_page_understanding(payload: PageUnderstandingRequest) -> PageUnderstandingResponse:
    features = build_features(payload.page_number, payload.blocks)
    lines_text = " ".join([b.text for b in payload.blocks]).lower()
    scores = score_page(features, lines_text, payload.page_number)
    page_type = resolve_page_type(scores)
    subtype = resolve_subtype(page_type, features)
    family = detect_family(payload.blocks, payload.family_hint)
    orientation = "landscape" if payload.width > payload.height else "portrait"

    return PageUnderstandingResponse(
        pageNumber=payload.page_number,
        orientationAuto=orientation,
        orientationFinal=orientation,
        pageTypeAuto=page_type,
        pageTypeFinal=page_type,
        subTypeAuto=subtype,
        subTypeFinal=subtype,
        confidence=confidence_from_scores(scores),
        features=features,
        scores=scores,
        userOverridden=False,
        documentFamily=family,
    )
