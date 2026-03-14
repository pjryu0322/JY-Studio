from app.classifier import build_features, score_page, resolve_page_type
from app.models import PageTextBlock


def test_cover_like_page_scores_cover_high():
    blocks = [
        PageTextBlock(text="Project Manual", x=0.4, y=0.1, width=0.2, height=0.05, page=1),
        PageTextBlock(text="Version 1.0", x=0.42, y=0.2, width=0.18, height=0.04, page=1),
    ]
    features = build_features(1, blocks)
    scores = score_page(features, "project manual version", 1)
    assert scores["coverScore"] > 0.2
    assert resolve_page_type(scores) in {"cover", "body"}


def test_table_like_page_scores_table():
    blocks = [
        PageTextBlock(text="항목 ... 1", x=0.1, y=0.1, width=0.8, height=0.03, page=2),
        PageTextBlock(text="수치 123", x=0.1, y=0.2, width=0.5, height=0.03, page=2),
        PageTextBlock(text="table data", x=0.1, y=0.3, width=0.6, height=0.03, page=2),
    ]
    features = build_features(2, blocks)
    scores = score_page(features, "table data", 2)
    assert scores["tableScore"] >= 0.18
