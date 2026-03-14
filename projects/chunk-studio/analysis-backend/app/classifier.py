from typing import List, Dict, Any
from .models import PageTextBlock, DocumentFamily, PageType, PageSubType


def detect_family(blocks: List[PageTextBlock], hint: DocumentFamily | None) -> DocumentFamily:
    if hint:
        return hint
    text = " ".join([b.text for b in blocks]).lower()
    if "rfp" in text or "제안요청서" in text or "입찰" in text:
        return "public_rfp"
    if "정책" in text or "규정" in text or "policy" in text:
        return "policy_manual"
    if "manual" in text or "guide" in text or "운영" in text:
        return "guide_manual"
    return "unknown_generic"


def build_features(page_number: int, blocks: List[PageTextBlock]) -> Dict[str, Any]:
    lines = [b.text.strip() for b in blocks if b.text.strip()]
    lengths = [len(x) for x in lines]
    merged = " ".join(lines)
    total_chars = max(1, len(merged.replace(" ", "")))
    numeric_ratio = sum(ch.isdigit() for ch in merged) / total_chars
    avg_len = sum(lengths) / max(1, len(lengths))
    short_line_ratio = sum(1 for n in lengths if n <= 16) / max(1, len(lengths))
    long_line_ratio = sum(1 for n in lengths if n >= 42) / max(1, len(lengths))
    dotted = sum(1 for line in lines if "..." in line) / max(1, len(lines))
    section_ratio = (
        sum(1 for line in lines if line[:1].isdigit()) / max(1, len(lines))
    )
    xs = [b.x for b in blocks] or [0.0]
    ys = [b.y for b in blocks] or [0.0]
    min_x, max_x = min(xs), max(xs)
    page_w = max(1.0, max_x - min_x)
    center = min_x + page_w / 2
    center_ratio = (
        sum(1 for b in blocks if abs((b.x + b.width / 2) - center) <= page_w * 0.11)
        / max(1, len(blocks))
    )
    min_y, max_y = min(ys), max(ys)
    page_h = max(1.0, max_y - min_y)
    top_ratio = sum(1 for b in blocks if b.y <= min_y + page_h * 0.2) / max(1, len(blocks))
    bottom_ratio = (
        sum(1 for b in blocks if b.y + b.height >= max_y - page_h * 0.2) / max(1, len(blocks))
    )
    return {
        "pageNumber": page_number,
        "textBlockCount": len(blocks),
        "averageLineLength": avg_len,
        "longLineRatio": long_line_ratio,
        "shortLineRatio": short_line_ratio,
        "numericRatio": numeric_ratio,
        "dottedLeaderRatio": dotted,
        "sectionNumberRatio": section_ratio,
        "largeTextBlockCount": 0,
        "centerAlignmentRatio": center_ratio,
        "gridStructureScore": min(1.0, (short_line_ratio + section_ratio) * 0.75),
        "topMarginTextRatio": top_ratio,
        "bottomMarginTextRatio": bottom_ratio,
    }


def score_page(features: Dict[str, Any], lines_text: str, page_number: int) -> Dict[str, float]:
    cover = 0.0
    toc = 0.0
    table = 0.0
    body = 0.0
    revision = 0.0

    if page_number == 1:
        cover += 0.18
    cover += min(0.3, features["centerAlignmentRatio"] * 0.4)
    cover += min(0.2, max(0.0, 0.5 - features["longLineRatio"]))

    toc += min(0.4, features["dottedLeaderRatio"] * 1.2)
    toc += min(0.2, features["sectionNumberRatio"] * 0.4)
    if "목차" in lines_text or "table of contents" in lines_text:
        toc += 0.2

    table += min(0.32, features["gridStructureScore"] * 0.45)
    table += min(0.3, features["numericRatio"] * 0.55)
    if "table" in lines_text or "표" in lines_text:
        table += 0.18

    body += min(0.35, features["longLineRatio"] * 0.42)
    body += min(0.2, features["averageLineLength"] / 120)

    if "revision" in lines_text or "개정" in lines_text or "이력" in lines_text:
        revision += 0.26
    revision += min(0.2, features["shortLineRatio"] * 0.24)
    revision += min(0.2, features["numericRatio"] * 0.36)

    scores = {
        "coverScore": min(1.0, cover),
        "tocScore": min(1.0, toc),
        "tableScore": min(1.0, table),
        "bodyScore": min(1.0, body),
        "revisionScore": min(1.0, revision),
    }
    return scores


def resolve_page_type(scores: Dict[str, float]) -> PageType:
    mapping: list[tuple[PageType, float]] = [
        ("cover", scores["coverScore"]),
        ("toc", scores["tocScore"]),
        ("table", scores["tableScore"]),
        ("body", scores["bodyScore"]),
        ("revision_or_form", scores["revisionScore"]),
    ]
    mapping.sort(key=lambda x: x[1], reverse=True)
    return mapping[0][0]


def resolve_subtype(page_type: PageType, features: Dict[str, Any]) -> PageSubType:
    if page_type == "cover":
        return "title_cover"
    if page_type == "toc":
        return "table_reference"
    if page_type in ("table", "revision_or_form"):
        return "revision_history_table"
    if features["gridStructureScore"] > 0.55:
        return "body_with_table"
    if features["centerAlignmentRatio"] > 0.25 and features["longLineRatio"] < 0.5:
        return "body_with_diagram"
    if features["shortLineRatio"] > 0.32:
        return "body_with_examples"
    return "narrative_body"


def confidence_from_scores(scores: Dict[str, float]) -> float:
    vals = sorted(scores.values(), reverse=True)
    top = vals[0] if vals else 0.0
    second = vals[1] if len(vals) > 1 else 0.0
    return max(0.0, min(1.0, top - second * 0.35 + 0.2))
