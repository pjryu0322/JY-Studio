/**
 * Rule-based title consistency between pack name, ND title, and source filenames.
 * Does not mutate pack display name.
 */

export type TitleMatchStatus = "MATCH" | "WARNING" | "MISMATCH";

const COPY_SUFFIX_RE =
  /(?:\s*[\(\[]\s*(?:copy|복사본|\d+)\s*[\)\]]|\s*-\s*copy(?:\s*\(\d+\))?|\s+copy(?:\s*\(\d+\))?)$/gi;
const TRAILING_BATCH_RE = /(?:[_\-\s]?v?\d{1,3})$/i;

function basename(pathLike: string): string {
  const normalized = pathLike.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] ?? pathLike;
}

function stripExtension(filename: string): string {
  const base = basename(filename);
  const lastDot = base.lastIndexOf(".");
  if (lastDot <= 0) return base;
  return base.slice(0, lastDot);
}

export function normalizeTitleKey(value: string | null | undefined): string {
  if (!value) return "";
  let stem = stripExtension(value.trim());
  stem = stem.normalize("NFKC");
  let prev = "";
  while (stem !== prev) {
    prev = stem;
    stem = stem.replace(COPY_SUFFIX_RE, "").trim();
  }
  const batchStripped = stem.replace(TRAILING_BATCH_RE, "").trim();
  if (batchStripped.length >= 8) stem = batchStripped;
  return stem
    .toLowerCase()
    .replace(/[_\-\s()[\]{}]+/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function compareTitleKeys(a: string, b: string): TitleMatchStatus {
  if (!a || !b) return "WARNING";
  if (a === b) return "MATCH";
  if (a.includes(b) || b.includes(a)) return "WARNING";
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  if (shorter.length >= 6 && longer.startsWith(shorter)) return "WARNING";
  return "MISMATCH";
}

export function evaluateDocumentTitleMatch(input: {
  packName?: string | null;
  documentTitle?: string | null;
  sourceFileName?: string | null;
  originFileName?: string | null;
}): {
  packVsDocument: TitleMatchStatus;
  sourceVsOrigin: TitleMatchStatus;
  warnings: string[];
} {
  const packKey = normalizeTitleKey(input.packName);
  const docKey = normalizeTitleKey(input.documentTitle);
  const sourceKey = normalizeTitleKey(input.sourceFileName);
  const originKey = normalizeTitleKey(input.originFileName);

  const packVsDocument = compareTitleKeys(packKey, docKey);
  const sourceVsOrigin = compareTitleKeys(sourceKey, originKey);
  const warnings: string[] = [];

  if (packVsDocument === "MISMATCH") {
    warnings.push(
      `DOCUMENT_TITLE_MISMATCH: Pack 표시명과 문서 제목이 다릅니다 (${packVsDocument}).`,
    );
  } else if (packVsDocument === "WARNING") {
    warnings.push(
      `DOCUMENT_TITLE_WARNING: Pack 표시명과 문서 제목 정합성을 확인하세요 (${packVsDocument}).`,
    );
  }
  if (sourceVsOrigin === "MISMATCH") {
    warnings.push(
      `DOCUMENT_TITLE_MISMATCH: 원본 파일명과 Docling origin.filename이 다릅니다.`,
    );
  } else if (sourceVsOrigin === "WARNING") {
    warnings.push(
      `DOCUMENT_TITLE_WARNING: 원본 파일명과 Docling origin.filename을 확인하세요.`,
    );
  }

  return { packVsDocument, sourceVsOrigin, warnings };
}
