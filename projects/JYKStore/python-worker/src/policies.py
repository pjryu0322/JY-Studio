"""File classification policies for archive inventory."""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import PurePosixPath

PARSER_VERSION = "0.1.0"

CLASS_KNOWLEDGE = "knowledge_target"
CLASS_REVIEW = "review_target"
CLASS_SUPPORTING = "supporting_asset"
CLASS_EXCLUDED = "excluded"

IMAGE_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".webp",
    ".bmp",
    ".ico",
    ".tif",
    ".tiff",
}

LICENSE_NAME_PATTERNS = [
    re.compile(r"license", re.I),
    re.compile(r"copyright", re.I),
    re.compile(r"readme", re.I),
    re.compile(r"사용권"),
    re.compile(r"라이선스"),
    re.compile(r"처음사용자"),
    re.compile(r"eula", re.I),
    re.compile(r"terms", re.I),
]

# Executable / library JS that should not be knowledge targets
LIBRARY_JS_HINTS = (
    "jquery",
    "react",
    "vue",
    "angular",
    "lodash",
    "underscore",
    "bootstrap",
    "polyfill",
    "bundle",
    "vendor",
    "webpack",
    "rmate",
    "grid",
    "chart",
)


@dataclass(frozen=True)
class ClassificationResult:
    classification: str
    parser: str | None
    excluded_reason: str | None
    file_type: str


def _normalize_path(source_path: str) -> PurePosixPath:
    return PurePosixPath(source_path.replace("\\", "/"))


def detect_file_type(extension: str) -> str:
    ext = extension.lower()
    mapping = {
        ".pdf": "pdf",
        ".html": "html",
        ".htm": "html",
        ".js": "javascript",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".jsx": "javascript",
        ".css": "css",
        ".json": "json",
        ".xml": "xml",
        ".md": "markdown",
        ".txt": "text",
        ".zip": "archive",
    }
    if ext in IMAGE_EXTENSIONS:
        return "image"
    return mapping.get(ext, ext.lstrip(".") or "unknown")


def is_license_filename(name: str) -> bool:
    stem = PurePosixPath(name).stem
    basename = PurePosixPath(name).name
    for pattern in LICENSE_NAME_PATTERNS:
        if pattern.search(basename) or pattern.search(stem):
            return True
    return False


def is_library_js(path: PurePosixPath) -> bool:
    name = path.name.lower()
    if name.endswith(".min.js"):
        return True
    # Top-level or lib/js library files
    parts_lower = [p.lower() for p in path.parts]
    if any(p in {"lib", "libs", "vendor", "vendors", "js"} for p in parts_lower[:-1]):
        if name.endswith(".js") and not any(
            token in name for token in ("sample", "demo", "example", "tutorial")
        ):
            return True
    # Known library name hints for non-sample JS
    if name.endswith(".js"):
        base = name[:-3]
        if any(hint in base for hint in LIBRARY_JS_HINTS) and "sample" not in parts_lower:
            # Keep sample HTML companions; exclude standalone lib scripts
            if "samples" not in parts_lower and "react_vue_samples" not in parts_lower:
                return True
    return False


def classify_file(source_path: str) -> ClassificationResult:
    """Classify a relative archive path into inventory categories."""
    path = _normalize_path(source_path)
    ext = path.suffix.lower()
    file_type = detect_file_type(ext)
    parts_lower = [p.lower() for p in path.parts]
    path_str = path.as_posix()
    path_lower = path_str.lower()

    # Hard excludes
    if "licensekey" in parts_lower:
        return ClassificationResult(
            CLASS_EXCLUDED, None, "LicenseKey folder excluded from knowledge", file_type
        )
    if any(p in {"fonts", "font"} for p in parts_lower):
        return ClassificationResult(
            CLASS_EXCLUDED, None, "fonts directory excluded", file_type
        )
    if any(p in {"styles", "style", "css"} for p in parts_lower) and ext in {
        ".css",
        ".scss",
        ".less",
        ".map",
    }:
        return ClassificationResult(
            CLASS_EXCLUDED, None, "styles/css asset excluded", file_type
        )
    if "styles" in parts_lower and ext != ".html":
        return ClassificationResult(
            CLASS_EXCLUDED, None, "styles directory excluded", file_type
        )
    if "dist" in parts_lower:
        return ClassificationResult(
            CLASS_EXCLUDED, None, "dist directory excluded", file_type
        )
    if "build" in parts_lower:
        return ClassificationResult(
            CLASS_EXCLUDED, None, "build directory excluded", file_type
        )
    if path.name.lower().endswith(".min.js"):
        return ClassificationResult(
            CLASS_EXCLUDED, None, "minified JS excluded", file_type
        )
    if ext == ".js" and is_library_js(path):
        return ClassificationResult(
            CLASS_EXCLUDED, None, "executable/library JS excluded", file_type
        )

    # License / copyright review
    if is_license_filename(path.name):
        return ClassificationResult(
            CLASS_REVIEW, "license_inspector", None, file_type
        )

    # PDF manuals
    if ext == ".pdf":
        return ClassificationResult(
            CLASS_KNOWLEDGE, "docling_pdf", None, file_type
        )

    # API HTML
    if ext in {".html", ".htm"}:
        # Docs/api/*.html
        if len(parts_lower) >= 2 and parts_lower[0] == "docs" and parts_lower[1] == "api":
            return ClassificationResult(
                CLASS_KNOWLEDGE, "html_api", None, file_type
            )
        # Nested Docs/.../api/
        if "docs" in parts_lower and "api" in parts_lower:
            api_idx = parts_lower.index("api")
            docs_idx = parts_lower.index("docs")
            if docs_idx < api_idx:
                return ClassificationResult(
                    CLASS_KNOWLEDGE, "html_api", None, file_type
                )

        # Sample HTML paths
        sample_roots = ("samples", "react_vue_samples", "serversamples")
        if any(root in parts_lower for root in sample_roots):
            return ClassificationResult(
                CLASS_KNOWLEDGE, "html_sample", None, file_type
            )

        # Other HTML — review or supporting
        return ClassificationResult(
            CLASS_REVIEW, None, None, file_type
        )

    # Images
    if file_type == "image":
        return ClassificationResult(
            CLASS_SUPPORTING, None, None, file_type
        )

    # Sample companion code (xml/json/js under samples) — supporting unless JS library
    if any(root in parts_lower for root in ("samples", "react_vue_samples", "serversamples")):
        if ext in {".xml", ".json", ".js", ".ts", ".jsx", ".tsx", ".css"}:
            return ClassificationResult(
                CLASS_SUPPORTING, None, None, file_type
            )

    # Default: excluded from knowledge
    return ClassificationResult(
        CLASS_EXCLUDED,
        None,
        f"no knowledge parser for {file_type or 'unknown'} file",
        file_type,
    )
