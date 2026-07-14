/**
 * Document title selection for Docling normalize — rejects OCR junk and TOC labels.
 */

const URL_RE = /https?:\/\/|www\./i;
const YEAR_ONLY = /^(19|20)\d{2}$/;
const LOGOISH = /^(logo|ci|bi|icon)$/i;
const ROMAN_ONLY =
  /^[IVXLCDMⅰⅱⅲⅳⅴⅵⅶⅷⅸⅹⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+$/i;

const TOC_COMPACT = new Set([
  "목차",
  "목차목록",
  "표목차",
  "그림목차",
  "차례",
  "tableofcontents",
  "listoftables",
  "listoffigures",
  "toc",
]);

/** Strip decorative brackets and normalize whitespace. */
export function normalizeTitleCandidate(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[<>[\](){}「」『』]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactTitle(value: string): string {
  return normalizeTitleCandidate(value).replace(/\s+/g, "").toLowerCase();
}

export function isAbnormalTitleCandidate(raw: string | null | undefined): boolean {
  if (!raw) return true;
  const value = normalizeTitleCandidate(raw);
  if (!value || value.length <= 2 || value.length > 150) return true;
  if (URL_RE.test(value)) return true;
  if (YEAR_ONLY.test(value) || /^\d+$/.test(value)) return true;
  if (LOGOISH.test(value)) return true;
  if (ROMAN_ONLY.test(value.replace(/\s+/g, ""))) return true;
  if (/^[A-Za-z]{1,2}$/.test(value)) return true;
  if (/\.[A-Za-z0-9]{1,8}$/.test(value) && !/\s/.test(value)) return true;

  const compact = compactTitle(value);
  if (TOC_COMPACT.has(compact)) return true;
  // spaced TOC forms already compact to 목차 / 표목차 / 그림목차
  if (/^(표|그림)?목\s*차$/.test(value.replace(/\s+/g, " "))) return true;

  const letters = value.replace(/\s/g, "");
  const alnum = letters.replace(/[^0-9A-Za-z가-힣]/g, "");
  if (!alnum) return true;

  const hangul = (letters.match(/[가-힣]/g) ?? []).length;
  const spaces = (value.match(/\s/g) ?? []).length;
  const digitSymbol = (letters.match(/[0-9A-Z._\-]/g) ?? []).length;
  if (hangul === 0 && spaces >= 2 && digitSymbol / Math.max(letters.length, 1) >= 0.7) {
    return true;
  }
  if (hangul === 0 && /^[A-Z0-9](?:\s+[A-Z0-9]{1,6}){1,6}$/.test(value)) {
    return true;
  }
  if (/^[A-Z0-9]{1,3}(?:\s+[A-Z0-9]{1,6}){1,4}$/.test(value) && /\d/.test(value)) {
    return true;
  }
  return false;
}

export function titleFromOriginFilename(filename: string | null | undefined): string | null {
  if (!filename?.trim()) return null;
  let stem = filename.trim().replace(/\\/g, "/");
  const slash = stem.lastIndexOf("/");
  if (slash >= 0) stem = stem.slice(slash + 1);
  stem = stem.replace(/\.[A-Za-z0-9]{1,8}$/, "");
  stem = stem.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  if (isAbnormalTitleCandidate(stem)) return null;
  return stem;
}

export function titleFromMarkdownFirstHeading(markdown: string | null | undefined): string | null {
  if (!markdown) return null;
  const lines = markdown.split(/\r?\n/).slice(0, 80);
  for (const line of lines) {
    const atx = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
    if (atx?.[2]) {
      const t = normalizeTitleCandidate(atx[2].replace(/#+\s*$/, ""));
      if (!isAbnormalTitleCandidate(t)) return t;
    }
  }
  for (let i = 0; i < lines.length - 1; i += 1) {
    const title = normalizeTitleCandidate(lines[i] ?? "");
    const under = lines[i + 1]?.trim() ?? "";
    if (title && /^=+$/.test(under) && !isAbnormalTitleCandidate(title)) return title;
  }
  return null;
}

export function selectNormalizedDocumentTitle(input: {
  headingCandidates: Array<string | null | undefined>;
  originFilename?: string | null;
  jsonName?: string | null;
  markdownText?: string | null;
}): { title: string | null; source: "heading" | "filename" | "json_name" | "markdown" | null } {
  for (const raw of input.headingCandidates) {
    const t = raw ? normalizeTitleCandidate(raw) : "";
    if (t && !isAbnormalTitleCandidate(t)) {
      return { title: t, source: "heading" };
    }
  }
  const fromFile = titleFromOriginFilename(input.originFilename);
  if (fromFile) return { title: fromFile, source: "filename" };

  const jsonName = input.jsonName ? normalizeTitleCandidate(input.jsonName) : "";
  if (jsonName && !isAbnormalTitleCandidate(jsonName)) {
    return { title: jsonName, source: "json_name" };
  }
  const fromMd = titleFromMarkdownFirstHeading(input.markdownText);
  if (fromMd) return { title: fromMd, source: "markdown" };
  return { title: null, source: null };
}
