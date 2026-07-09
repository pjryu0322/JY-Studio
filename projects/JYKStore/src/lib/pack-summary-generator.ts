const SHORT_DESCRIPTION_MIN = 10;
const SHORT_DESCRIPTION_MAX = 160;

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
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

  if (summary.length < SHORT_DESCRIPTION_MIN) {
    summary = buildNameFallback(name);
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
