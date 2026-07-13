import {
  DOCLING_ERROR_CODES,
  issue,
  type DoclingIssue,
} from "./docling-errors";
import type {
  OriginMatchResult,
  OriginMatchStatus,
} from "./docling-types";

export type { OriginMatchResult, OriginMatchStatus };

const COPY_SUFFIX_RE =
  /(?:\s*[\(\[]\s*(?:copy|복사본|\d+)\s*[\)\]]|\s*-\s*copy(?:\s*\(\d+\))?|\s+copy(?:\s*\(\d+\))?)$/gi;

const EXT_MIME: Record<string, string[]> = {
  pdf: ["application/pdf"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
  ],
  doc: ["application/msword"],
  pptx: [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-powerpoint",
  ],
  ppt: ["application/vnd.ms-powerpoint"],
  xlsx: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ],
  xls: ["application/vnd.ms-excel"],
  html: ["text/html", "application/xhtml+xml"],
  htm: ["text/html", "application/xhtml+xml"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  tiff: ["image/tiff"],
  tif: ["image/tiff"],
  md: ["text/markdown", "text/plain"],
  txt: ["text/plain"],
  json: ["application/json", "text/json"],
};

function basename(pathLike: string): string {
  const normalized = pathLike.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] ?? pathLike;
}

function stripExtension(filename: string): { stem: string; ext: string } {
  const base = basename(filename);
  const lastDot = base.lastIndexOf(".");
  if (lastDot <= 0) return { stem: base, ext: "" };
  return {
    stem: base.slice(0, lastDot),
    ext: base.slice(lastDot + 1).toLowerCase(),
  };
}

function stripCopySuffixes(stem: string): string {
  let current = stem;
  let prev = "";
  while (current !== prev) {
    prev = current;
    current = current.replace(COPY_SUFFIX_RE, "").trim();
  }
  return current;
}

/** Normalize a filename for logical comparison. */
export function normalizeFilenameForMatch(filename: string): string {
  const { stem } = stripExtension(filename.trim());
  const withoutCopy = stripCopySuffixes(stem);
  return withoutCopy.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
}

export function extractExtension(filename: string): string {
  return stripExtension(filename.trim()).ext;
}

function softFilenameStatus(
  originNorm: string,
  sourceNorm: string,
): OriginMatchStatus {
  if (originNorm === sourceNorm) return "MATCH";
  if (!originNorm || !sourceNorm) return "MISMATCH";
  if (originNorm.includes(sourceNorm) || sourceNorm.includes(originNorm)) {
    return "WARNING";
  }
  // Shared significant prefix (e.g. "report-final" vs "report")
  const minLen = Math.min(originNorm.length, sourceNorm.length);
  if (minLen >= 4) {
    let shared = 0;
    while (
      shared < minLen &&
      originNorm[shared] === sourceNorm[shared]
    ) {
      shared += 1;
    }
    if (shared / Math.max(originNorm.length, sourceNorm.length) >= 0.7) {
      return "WARNING";
    }
  }
  return "MISMATCH";
}

function mimeAliases(mime: string): Set<string> {
  const lower = mime.trim().toLowerCase();
  const set = new Set<string>([lower]);
  // drop parameters: application/pdf; charset=utf-8
  const base = lower.split(";")[0]?.trim() ?? lower;
  set.add(base);
  return set;
}

function mimesForExtension(ext: string): string[] {
  return EXT_MIME[ext.toLowerCase()] ?? [];
}

function softMimetypeStatus(
  originMime: string | undefined,
  sourceMime: string | undefined,
  sourceFilename: string | undefined,
): OriginMatchStatus {
  if (!originMime) return "MISMATCH";
  const originSet = mimeAliases(originMime);

  if (sourceMime) {
    const sourceSet = mimeAliases(sourceMime);
    for (const m of sourceSet) {
      if (originSet.has(m)) return "MATCH";
    }
    // soft: same type family (image/*, text/*)
    const oType = [...originSet][0]?.split("/")[0];
    const sType = [...sourceSet][0]?.split("/")[0];
    if (oType && sType && oType === sType) return "WARNING";
  }

  if (sourceFilename) {
    const ext = extractExtension(sourceFilename);
    const expected = mimesForExtension(ext);
    for (const m of expected) {
      if (originSet.has(m)) return sourceMime ? "WARNING" : "MATCH";
    }
    if (expected.length > 0) return "MISMATCH";
  }

  if (!sourceMime && !sourceFilename) return "MATCH";
  return sourceMime ? "MISMATCH" : "WARNING";
}

export function matchOriginToSource(options: {
  originFilename?: string;
  originMimetype?: string;
  sourceFilename?: string;
  sourceMimetype?: string;
}): OriginMatchResult {
  const issues: DoclingIssue[] = [];
  const {
    originFilename,
    originMimetype,
    sourceFilename,
    sourceMimetype,
  } = options;

  let filenameStatus: OriginMatchStatus = "MATCH";
  if (originFilename && sourceFilename) {
    const a = normalizeFilenameForMatch(originFilename);
    const b = normalizeFilenameForMatch(sourceFilename);
    filenameStatus = softFilenameStatus(a, b);
    if (filenameStatus === "MISMATCH") {
      issues.push(
        issue(
          DOCLING_ERROR_CODES.SOURCE_FILENAME_MISMATCH,
          "ERROR",
          `origin.filename "${originFilename}" does not match source filename "${sourceFilename}".`,
          {
            field: "origin.filename",
            hint: "등록한 원본 파일명과 Docling origin.filename이 논리적으로 일치해야 합니다.",
          },
        ),
      );
    } else if (filenameStatus === "WARNING") {
      issues.push(
        issue(
          DOCLING_ERROR_CODES.SOURCE_FILENAME_MISMATCH,
          "WARNING",
          `origin.filename "${originFilename}" only partially matches source filename "${sourceFilename}".`,
          { field: "origin.filename" },
        ),
      );
    }
  }

  let mimetypeStatus: OriginMatchStatus = "MATCH";
  if (originMimetype) {
    mimetypeStatus = softMimetypeStatus(
      originMimetype,
      sourceMimetype,
      sourceFilename,
    );
    if (mimetypeStatus === "MISMATCH") {
      issues.push(
        issue(
          DOCLING_ERROR_CODES.SOURCE_MIMETYPE_MISMATCH,
          "ERROR",
          `origin.mimetype "${originMimetype}" does not match source MIME/extension.`,
          {
            field: "origin.mimetype",
            hint: "원본 확장자·MIME과 Docling origin.mimetype을 확인하세요.",
          },
        ),
      );
    } else if (mimetypeStatus === "WARNING") {
      issues.push(
        issue(
          DOCLING_ERROR_CODES.SOURCE_MIMETYPE_MISMATCH,
          "WARNING",
          `origin.mimetype "${originMimetype}" only softly matches source MIME/extension.`,
          { field: "origin.mimetype" },
        ),
      );
    }
  }

  return { filenameStatus, mimetypeStatus, issues };
}
