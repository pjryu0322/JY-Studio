from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict, Any

PageType = Literal["cover", "toc", "table", "body", "revision_or_form"]
PageSubType = Literal[
    "title_cover",
    "revision_history_table",
    "narrative_body",
    "body_with_diagram",
    "body_with_table",
    "table_reference",
    "body_with_examples",
]
DocumentFamily = Literal["guide_manual", "public_rfp", "policy_manual", "unknown_generic"]
Orientation = Literal["portrait", "landscape"]


class PageTextBlock(BaseModel):
    text: str
    x: float
    y: float
    width: float
    height: float
    page: int


class PageUnderstandingRequest(BaseModel):
    page_number: int = Field(..., ge=1)
    width: float = Field(..., gt=0)
    height: float = Field(..., gt=0)
    blocks: List[PageTextBlock] = Field(default_factory=list)
    family_hint: Optional[DocumentFamily] = None


class PageUnderstandingResponse(BaseModel):
    pageNumber: int
    orientationAuto: Orientation
    orientationFinal: Orientation
    pageTypeAuto: PageType
    pageTypeFinal: PageType
    subTypeAuto: PageSubType
    subTypeFinal: PageSubType
    confidence: float
    features: Dict[str, Any]
    scores: Dict[str, float]
    userOverridden: bool
    documentFamily: DocumentFamily
