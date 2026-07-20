"""ZIP entry path decoding and safe artifact filename helpers."""

from __future__ import annotations

import hashlib
import re
import struct
import zlib
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

ZIP_UTF8_FLAG = 0x800

# Windows / cross-platform unsafe filename characters
_UNSAFE_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
_MULTI_UNDERSCORE = re.compile(r"_+")


@dataclass(frozen=True)
class DecodedZipPath:
    """Decoded ZIP member path metadata."""

    source_path: str
    """Recovered display path (POSIX)."""

    raw_source_path: str
    """Path as initially exposed by zipfile."""

    path_encoding: str
    """utf-8 | cp949 | euc-kr | unknown"""

    path_decoded: bool
    """True when decoding succeeded (incl. ASCII / UTF-8 flag)."""

    warning: str | None = None


def _posix(path: str) -> str:
    return path.replace("\\", "/")


def _has_hangul(text: str) -> bool:
    return any("\uac00" <= ch <= "\ud7a3" for ch in text)


def _try_legacy_decode(raw: str) -> tuple[str, str] | None:
    """
    CP437 mojibake → CP949 / EUC-KR recovery.
    Returns (recovered_path, encoding) or None.
    """
    try:
        raw_bytes = raw.encode("cp437")
    except UnicodeEncodeError:
        return None
    for encoding in ("cp949", "euc-kr"):
        try:
            recovered = _posix(raw_bytes.decode(encoding))
        except UnicodeDecodeError:
            continue
        if recovered != raw or _has_hangul(recovered):
            return recovered, encoding
        return recovered, encoding
    return None


def looks_like_cp437_korean_mojibake(text: str) -> bool:
    """True when text has no Hangul but CP949 recovery yields Hangul."""
    if not text or text.isascii() or _has_hangul(text):
        return False
    recovered = _try_legacy_decode(text)
    if not recovered:
        return False
    return _has_hangul(recovered[0])


def decode_zip_filename(info: zipfile.ZipInfo) -> DecodedZipPath:
    """
    Recover ZIP entry filenames for Windows CP949/EUC-KR archives.

    Order:
    1. UTF-8 flag set → use zipfile filename as utf-8
       (unless it looks like CP437/Korean mojibake — then recover)
    2. Else CP437 raw bytes → CP949
    3. Else EUC-KR
    4. Else keep original with warning
    """
    raw = _posix(info.filename)

    if info.flag_bits & ZIP_UTF8_FLAG:
        # Some writers set UTF-8 flag incorrectly; still try legacy recovery
        if looks_like_cp437_korean_mojibake(raw):
            recovered = _try_legacy_decode(raw)
            if recovered:
                path, encoding = recovered
                return DecodedZipPath(
                    source_path=path,
                    raw_source_path=raw,
                    path_encoding=encoding,
                    path_decoded=True,
                )
        return DecodedZipPath(
            source_path=raw,
            raw_source_path=raw,
            path_encoding="utf-8",
            path_decoded=True,
        )

    # ASCII-only names need no legacy recovery
    if raw.isascii():
        return DecodedZipPath(
            source_path=raw,
            raw_source_path=raw,
            path_encoding="utf-8",
            path_decoded=True,
        )

    recovered = _try_legacy_decode(raw)
    if recovered:
        path, encoding = recovered
        return DecodedZipPath(
            source_path=path,
            raw_source_path=raw,
            path_encoding=encoding,
            path_decoded=True,
        )

    return DecodedZipPath(
        source_path=raw,
        raw_source_path=raw,
        path_encoding="unknown",
        path_decoded=False,
        warning=f"zip path encoding recovery failed: {raw}",
    )


def write_cp949_zip(zip_path: Path, files: dict[str, bytes | str]) -> None:
    """
    Create a ZIP with CP949-encoded entry names and UTF-8 flag cleared.

    Used by tests to simulate Windows Explorer / legacy Korean ZIPs.
    Python's zipfile.writestr cannot do this because it forces UTF-8 for
    non-ASCII names.
    """
    records: list[tuple[bytes, int, int, int]] = []
    with zip_path.open("wb") as fp:
        for name, data in files.items():
            if isinstance(data, str):
                data = data.encode("utf-8")
            name_b = name.encode("cp949")
            crc = zlib.crc32(data) & 0xFFFFFFFF
            offset = fp.tell()
            # Local file header (store, no UTF-8 flag)
            fp.write(b"PK\x03\x04")
            fp.write(
                struct.pack(
                    "<HHHHHIIIHH",
                    20,  # version needed
                    0,  # general purpose bit flag (no 0x800)
                    0,  # compression method: store
                    0,
                    0,  # time, date
                    crc,
                    len(data),
                    len(data),
                    len(name_b),
                    0,  # extra length
                )
            )
            fp.write(name_b)
            fp.write(data)
            records.append((name_b, crc, len(data), offset))

        central_offset = fp.tell()
        for name_b, crc, size, offset in records:
            fp.write(b"PK\x01\x02")
            fp.write(
                struct.pack(
                    "<HHHHHHIIIHHHHHII",
                    20,  # version made by
                    20,  # version needed
                    0,  # flag
                    0,  # method
                    0,
                    0,  # time, date
                    crc,
                    size,
                    size,
                    len(name_b),
                    0,  # extra
                    0,  # comment
                    0,  # disk start
                    0,  # internal attr
                    0,  # external attr
                    offset,
                )
            )
            fp.write(name_b)
        central_size = fp.tell() - central_offset
        fp.write(b"PK\x05\x06")
        fp.write(
            struct.pack(
                "<HHHHIIH",
                0,
                0,
                len(records),
                len(records),
                central_size,
                central_offset,
                0,
            )
        )


def safe_artifact_basename(
    *,
    kind: str,
    index: int,
    source_path: str,
    suffix: str = ".json",
) -> str:
    """
    Build a filesystem-safe artifact filename.

    Example: pdf_001_rMateGridH5_6_0_사용설명서_a1b2c3d4.json
    """
    stem = PurePosixPath(_posix(source_path)).stem
    # Keep letters, digits, Hangul, dot, hyphen; normalize rest
    slug = re.sub(r"[^\w.\uac00-\ud7a3-]+", "_", stem, flags=re.UNICODE)
    slug = slug.replace(".", "_")
    slug = _UNSAFE_CHARS.sub("_", slug)
    slug = _MULTI_UNDERSCORE.sub("_", slug).strip("._")
    if not slug:
        slug = "file"
    slug = slug[:80]
    digest = hashlib.sha256(_posix(source_path).encode("utf-8")).hexdigest()[:8]
    kind_safe = re.sub(r"[^\w-]+", "", kind) or "file"
    return f"{kind_safe}_{index:03d}_{slug}_{digest}{suffix}"


def artifact_output_path(
    artifacts_dir: Path,
    *,
    kind: str,
    index: int,
    source_path: str,
    suffix: str = ".json",
) -> Path:
    return artifacts_dir / safe_artifact_basename(
        kind=kind, index=index, source_path=source_path, suffix=suffix
    )
