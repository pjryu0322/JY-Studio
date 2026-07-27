"""ZIP default exclusion policy (P7.4).

The Worker excludes files that are not knowledge-data targets (executables,
installers, nested archives, build/cache folders, system files, oversized
binaries) from the structuring pipeline. This is a *business* exclusion layer:

- Hardcoded security guards (zip-slip, absolute paths, symlinks, size/count
  ceilings) live in ``parse_archive`` and can never be relaxed by config.
- This policy layer is configuration-driven and merges a user-provided config
  file over safe built-in defaults.

The original ZIP is never modified; only what the Worker extracts / structures
is limited. Excluded entries are recorded in the validation report.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any

# Exclusion reasons — fixed, testable string values shared with the report.
REASON_BLOCKED_PATH_TRAVERSAL = "blocked_path_traversal"
REASON_BLOCKED_ABSOLUTE_PATH = "blocked_absolute_path"
REASON_BLOCKED_SYMLINK = "blocked_symlink"
REASON_EXCLUDED_DIRECTORY = "excluded_directory"
REASON_EXCLUDED_FILE_NAME = "excluded_file_name"
REASON_EXCLUDED_EXTENSION = "excluded_extension"
REASON_FILE_SIZE_EXCEEDED = "file_size_exceeded"
REASON_UNSUPPORTED_ENTRY_TYPE = "unsupported_entry_type"
# Admin 사전정리에서 선택한 경로 (Store options.adminExcludePaths).
REASON_ADMIN_PREFLIGHT_EXCLUDED = "admin_preflight_excluded"

MB = 1024 * 1024

# Safe built-in defaults. Kept in sync with config/zip_exclusion_policy.json but
# authoritative on their own so the Worker never depends on the file existing.
BUILT_IN_DEFAULTS: dict[str, Any] = {
    "excludeExtensions": [
        ".exe",
        ".dll",
        ".msi",
        ".bat",
        ".cmd",
        ".ps1",
        ".sh",
        ".jar",
        ".war",
        ".class",
        ".bin",
        ".dat",
        ".zip",
        ".7z",
        ".rar",
        ".tar",
        ".gz",
    ],
    "excludeDirectories": [
        ".git",
        "__MACOSX",
        "node_modules",
        "dist",
        "build",
        "target",
        ".next",
        ".cache",
    ],
    "excludeFileNames": [
        ".DS_Store",
        "Thumbs.db",
    ],
    "maxFileSizeMb": 50,
}


def default_policy_path() -> Path:
    """Path to the bundled default policy file (python-worker/config/...)."""
    return Path(__file__).resolve().parent.parent / "config" / "zip_exclusion_policy.json"


@dataclass(frozen=True)
class ExclusionPolicy:
    """Normalized, case-insensitive lookup sets for fast entry evaluation."""

    exclude_extensions: frozenset[str]
    exclude_directories: frozenset[str]
    exclude_file_names: frozenset[str]
    max_file_size_bytes: int | None

    @property
    def max_file_size_mb(self) -> float | None:
        if self.max_file_size_bytes is None:
            return None
        return self.max_file_size_bytes / MB


def _as_str_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(v) for v in value if isinstance(v, (str, int, float)) and str(v).strip()]


def _norm_ext(ext: str) -> str:
    ext = ext.strip().lower()
    if ext and not ext.startswith("."):
        ext = "." + ext
    return ext


def build_policy(config: dict[str, Any] | None) -> ExclusionPolicy:
    """Merge ``config`` over built-in defaults into a normalized policy.

    Missing or empty fields fall back to the built-in default for that field.
    All matching is case-insensitive.
    """
    cfg = config or {}

    def pick(key: str) -> list[str]:
        provided = _as_str_list(cfg.get(key))
        return provided if provided else _as_str_list(BUILT_IN_DEFAULTS.get(key))

    extensions = frozenset(_norm_ext(e) for e in pick("excludeExtensions"))
    directories = frozenset(d.strip().lower() for d in pick("excludeDirectories"))
    file_names = frozenset(f.strip().lower() for f in pick("excludeFileNames"))

    raw_size = cfg.get("maxFileSizeMb", BUILT_IN_DEFAULTS.get("maxFileSizeMb"))
    max_bytes: int | None
    try:
        max_bytes = int(float(raw_size) * MB) if raw_size is not None else None
        if max_bytes is not None and max_bytes <= 0:
            max_bytes = None
    except (TypeError, ValueError):
        max_bytes = int(float(BUILT_IN_DEFAULTS["maxFileSizeMb"]) * MB)

    return ExclusionPolicy(
        exclude_extensions=extensions,
        exclude_directories=directories,
        exclude_file_names=file_names,
        max_file_size_bytes=max_bytes,
    )


def load_exclusion_policy(path: Path | str | None = None) -> ExclusionPolicy:
    """Load the exclusion policy from ``path`` (default: bundled config).

    Robust by design: a missing file or an unreadable / malformed JSON file
    falls back to built-in defaults rather than failing the Worker. Partial
    files are merged field-by-field over the defaults.
    """
    target = Path(path) if path is not None else default_policy_path()
    if not target.is_file():
        return build_policy(None)
    try:
        raw = json.loads(target.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return build_policy(None)
    if not isinstance(raw, dict):
        return build_policy(None)
    return build_policy(raw)


def normalize_zip_path(source_path: str) -> str:
    """Normalize a ZIP entry path for comparison (posix, no leading/trailing slash)."""
    return source_path.replace("\\", "/").strip("/")


def match_admin_exclude_path(
    source_path: str,
    exclude_paths: list[str] | tuple[str, ...] | None,
) -> str | None:
    """Return the matching Admin exclude rule when ``source_path`` is covered.

    A rule matches when the entry path equals the rule, or is nested under it
    (``Samples`` excludes ``Samples/a.html``). Used for Admin 사전정리 selections.
    """
    if not exclude_paths:
        return None
    norm = normalize_zip_path(source_path)
    if not norm:
        return None
    for raw in exclude_paths:
        if not isinstance(raw, str):
            continue
        rule = normalize_zip_path(raw)
        if not rule:
            continue
        if norm == rule or norm.startswith(rule + "/"):
            return rule
    return None


def evaluate_entry(
    policy: ExclusionPolicy,
    source_path: str,
    file_size: int | None = None,
    *,
    admin_exclude_paths: list[str] | tuple[str, ...] | None = None,
) -> tuple[str | None, str | None]:
    """Return ``(reason, detail)`` if the entry should be excluded, else ``(None, None)``.

    Evaluation order (business layer only; security guards run earlier):
      0. Admin 사전정리 path exclusions (when provided)
      1. directory exclusion
      2. file name exclusion
      3. extension exclusion
      4. file size
    """
    admin_rule = match_admin_exclude_path(source_path, admin_exclude_paths)
    if admin_rule is not None:
        return REASON_ADMIN_PREFLIGHT_EXCLUDED, admin_rule

    path = PurePosixPath(source_path.replace("\\", "/"))
    parts_lower = [p.lower() for p in path.parts]
    name_lower = path.name.lower()

    # 1. directory exclusion — any ancestor directory component matches.
    for part in parts_lower[:-1]:
        if part in policy.exclude_directories:
            return REASON_EXCLUDED_DIRECTORY, part

    # 2. file name exclusion (basename match).
    if name_lower in policy.exclude_file_names:
        return REASON_EXCLUDED_FILE_NAME, path.name

    # 3. extension exclusion.
    ext = path.suffix.lower()
    if ext and ext in policy.exclude_extensions:
        return REASON_EXCLUDED_EXTENSION, ext

    # 4. file size.
    if (
        policy.max_file_size_bytes is not None
        and file_size is not None
        and file_size > policy.max_file_size_bytes
    ):
        return REASON_FILE_SIZE_EXCEEDED, str(file_size)

    return None, None
