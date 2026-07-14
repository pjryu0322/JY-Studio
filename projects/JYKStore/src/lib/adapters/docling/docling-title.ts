/**
 * Document title selection for Docling normalize — rejects OCR junk.
 */

const TOC_ONLY = /^(목차|표\s*목차|그림\s*목차|table of contents|list of (tables|figures)|toc)$/i;
const URL_RE = /https?:\/\/|www\./i;
const YEAR_ONLY = /^(19|20)\d{2}$/;
const LOGOISH = /^(logo|ci|bi|icon)$/i;

export function isAbnormalTitleCandidate(raw: string | null | undefined): boolean {
  if (!raw) return true;
  const value = raw.trim().replace(/\s+/g, " ");
  if (value.length <= 2 || value.length > 150) return true;
  if (TOC_ONLY.test(value)) return true;
  if (URL_RE.test(value)) return true;
  if (YEAR_ONLY.test(value) || /^\d+$/.test(value)) return true;
  if (LOGOISH.test(value)) return true;

  const letters = value.replace(/\s/g, "");
  const alnum = letters.replace(/[^0-9A-Za-z가-힣]/g, "");
  if (!alnum) return true;

  // High symbol / digit ratio — OCR fragments like "S CH7M 71015"
  const digitSymbol = (letters.match(/[0-9A-Z._\-]/g) ?? []).length;
  const hangul = (letters.match(/[가-힣]/g) ?? []).length;
  const spaces = (value.match(/\s/g) ?? []).length;
  if (hangul === 0 && spaces >= 2 && digitSymbol / Math.max(letters.length, 1) >= 0.7) {
    return true;
  }
  if (hangul === 0 && /^[A-Z0-9](?:\s+[A-Z0-9]{1,6}){1,6}$/.test(value)) {
    return true;
  }
  // Fragmented all-caps tokens with digits
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
      const t = atx[2].replace(/#+\s*$/, "").trim();
      if (!isAbnormalTitleCandidate(t)) return t;
    }
    // Setext: title\n====
  }
  for (let i = 0; i < lines.length - 1; i += 1) {
    const title = lines[i]?.trim() ?? "";
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
    const t = raw?.trim();
    if (t && !isAbnormalTitleCandidate(t)) {
      return { title: t, source: "heading" };
    }
  }
  const fromFile = titleFromOriginFilename(input.originFilename);
  if (fromFile) return { title: fromFile, source: "filename" };

  const jsonName = input.jsonName?.trim() ?? "";
  if (jsonName && !isAbnormalTitleCandidate(jsonName)) {
    return { title: jsonName, source: "json_name" };
  }
  const fromMd = titleFromMarkdownFirstHeading(input.markdownText);
  if (fromMd) return { title: fromMd, source: "markdown" };
  return { title: null, source: null };
}
