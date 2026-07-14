const SHORT_DESCRIPTION_MIN = 10;
const SHORT_DESCRIPTION_MAX = 160;
/** Preferred length for auto-derived one-line summaries (UI may allow up to MAX). */
const SHORT_DESCRIPTION_PREFERRED_MAX = 120;

export const PROVIDER_PACK_INITIAL_VERSION_CHANGELOG = "최초 등록 버전입니다.";

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function looksLikeBibliographicOrStatuteSnippet(text: string): boolean {
  return /고시\s*제|법령|시행령|시행규칙|공포일|관보|제\d+\s*조/.test(text);
}

function truncateAtSentenceBoundary(text: string, maxLen: number): string {
  if (text.length <= maxLen) {
    return text;
  }

  const slice = text.slice(0, maxLen);
  const lastSentenceEnd = Math.max(
    slice.lastIndexOf("."),
    slice.lastIndexOf("!"),
    slice.lastIndexOf("?"),
    slice.lastIndexOf("。"),
  );

  if (lastSentenceEnd >= SHORT_DESCRIPTION_MIN - 1) {
    return slice.slice(0, lastSentenceEnd + 1).trim();
  }

  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace >= SHORT_DESCRIPTION_MIN) {
    return slice.slice(0, lastSpace).trim();
  }

  return slice.trim();
}

function extractFirstSentenceOrLine(description: string): string {
  const normalized = description.replace(/\r\n/g, "\n");
  const firstLine = normalized.split("\n").find((line) => line.trim().length > 0)?.trim() ?? "";
  const fromLine = normalizeWhitespace(firstLine);

  const sentenceMatch = fromLine.match(/^(.+?[.!?。])(?:\s|$)/);
  if (sentenceMatch?.[1]) {
    return normalizeWhitespace(sentenceMatch[1]);
  }

  return fromLine;
}

function buildNameFallback(name: string): string {
  return `${name.trim()} 관련 제품·솔루션 지식팩입니다.`;
}

export function deriveShortDescription(input: {
  name: string;
  description: string;
  fallbackCategoryName?: string;
}): string {
  const name = input.name.trim();
  let summary = extractFirstSentenceOrLine(input.description);

  if (
    summary.length < SHORT_DESCRIPTION_MIN ||
    looksLikeBibliographicOrStatuteSnippet(summary)
  ) {
    summary = buildNameFallback(name);
  }

  if (summary.length > SHORT_DESCRIPTION_PREFERRED_MAX) {
    summary = truncateAtSentenceBoundary(summary, SHORT_DESCRIPTION_PREFERRED_MAX);
  }

  if (summary.length > SHORT_DESCRIPTION_MAX) {
    summary = truncateAtSentenceBoundary(summary, SHORT_DESCRIPTION_MAX);
  }

  if (summary.length < SHORT_DESCRIPTION_MIN) {
    summary = buildNameFallback(name);
    if (summary.length > SHORT_DESCRIPTION_MAX) {
      summary = summary.slice(0, SHORT_DESCRIPTION_MAX).trim();
    }
  }

  return summary;
}

/**
 * Canonical public summary is KnowledgePack.shortDescription.
 * Fall back to legacy version.overview only when canonical is empty
 * (older flows sometimes stored the summary only on overview).
 */
export function resolveProviderEditableShortDescription(input: {
  shortDescription: string;
  overview?: string | null;
}): string {
  const canonical = input.shortDescription.trim();
  if (canonical) {
    return input.shortDescription;
  }

  const overview = (input.overview ?? "").trim();
  if (overview && overview !== PROVIDER_PACK_INITIAL_VERSION_CHANGELOG) {
    return overview;
  }

  return input.shortDescription;
}

/**
 * Version overview is changelog text, not a document blurb.
 * Empty or legacy-duplicated overview (copied from shortDescription) gets a clear default.
 */
export function resolveProviderEditableVersionChangelog(input: {
  overview: string;
  shortDescription: string;
}): string {
  const overview = input.overview.trim();
  const short = input.shortDescription.trim();
  if (!overview) {
    return PROVIDER_PACK_INITIAL_VERSION_CHANGELOG;
  }
  if (short && overview === short) {
    return PROVIDER_PACK_INITIAL_VERSION_CHANGELOG;
  }
  return input.overview;
}
