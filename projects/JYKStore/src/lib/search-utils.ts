const MAX_TOKENS = 10;

/** Longest-first Korean particles stripped from query tokens only (조사). */
const KOREAN_PARTICLE_SUFFIXES = [
  "에서부터",
  "에서",
  "으로",
  "부터",
  "까지",
  "이나",
  "에게",
  "한테",
  "과",
  "와",
  "이",
  "가",
  "은",
  "는",
  "을",
  "를",
  "의",
  "에",
  "로",
  "나",
  "도",
  "만",
  "께",
  "할",
] as const;

/**
 * Generic Korean/English query stopwords (not product-specific).
 * Removes conversational filler that otherwise spuriously matches TOC/API index pages.
 */
const QUERY_STOPWORDS = new Set([
  "관련",
  "관련된",
  "대해",
  "대한",
  "기능",
  "방법",
  "무엇",
  "어떻게",
  "찾아줘",
  "알려줘",
  "해주세요",
  "좀",
  "있는",
  "하는",
  "하는가",
  "please",
  "how",
  "what",
  "where",
  "find",
  "show",
  "tell",
  "me",
  "the",
  "a",
  "an",
  "to",
  "for",
  "with",
  "about",
  "related",
  "in",
  "using",
  "into",
  "from",
  "with",
  "and",
  "or",
  "of",
  // Generic "api" matches Docs/api Index TOC pages and drowns product terms.
  "api",
  "apis",
  "grid",
  "grids",
  "cell",
  "cells",
  "rmate",
  "rmategrid",
  "html5",
]);

/** Small bilingual expansions for common developer terms (query-side only). */
const QUERY_SYNONYMS: Record<string, readonly string[]> = {
  병합: ["merge", "merging"],
  merge: ["병합"],
  merging: ["병합"],
  이벤트: ["event"],
  event: ["이벤트"],
  속성: ["property", "properties"],
  property: ["속성"],
  properties: ["속성"],
};

function hasHangul(value: string): boolean {
  return /[가-힣]/.test(value);
}

/**
 * Strip one trailing Korean particle from a query token.
 * Applied to query tokenization only — never rewrites stored chunk text.
 */
export function stripKoreanQuerySuffix(token: string): string {
  if (!token) return token;

  // Latin/API tokens with a hanging Hangul particle: "api를" → "api"
  if (!hasHangul(token.slice(0, 1)) && hasHangul(token)) {
    for (const suffix of KOREAN_PARTICLE_SUFFIXES) {
      if (!token.endsWith(suffix)) continue;
      const stem = token.slice(0, -suffix.length);
      if (stem.length >= 2 && /^[a-z0-9_./-]+$/i.test(stem)) {
        return stem.toLowerCase();
      }
    }
    return token;
  }

  if (!hasHangul(token)) return token;

  for (const suffix of KOREAN_PARTICLE_SUFFIXES) {
    if (!token.endsWith(suffix)) continue;
    const stem = token.slice(0, -suffix.length);
    if (stem.length >= 2 && hasHangul(stem)) {
      return stem;
    }
  }
  return token;
}

export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[\t\n\r]+/g, " ")
    .replace(/[()[\]{}.,;:|/\\?!'"“”‘’]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeSearchQuery(query: string | null | undefined): string[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];

  const seen = new Set<string>();
  const tokens: string[] = [];

  for (const raw of normalized.split(" ")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const token = stripKoreanQuerySuffix(trimmed);
    if (!token) continue;
    if (QUERY_STOPWORDS.has(token)) continue;

    const isShortAllowed =
      token.length === 1 && (/[0-9a-z]/.test(token) || hasHangul(token));
    if (token.length < 2 && !isShortAllowed) continue;

    if (seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);

    for (const syn of QUERY_SYNONYMS[token] ?? []) {
      if (seen.has(syn)) continue;
      if (QUERY_STOPWORDS.has(syn)) continue;
      seen.add(syn);
      tokens.push(syn);
      if (tokens.length >= MAX_TOKENS) break;
    }

    if (tokens.length >= MAX_TOKENS) break;
  }

  return tokens;
}

export function includesNormalized(
  haystack: string | null | undefined,
  needle: string,
): boolean {
  const normalizedNeedle = normalizeSearchText(needle);
  if (!normalizedNeedle) return false;
  return normalizeSearchText(haystack).includes(normalizedNeedle);
}

export function countTokenMatches(
  fields: Array<string | null | undefined>,
  tokens: string[],
): number {
  let count = 0;
  for (const token of tokens) {
    if (fields.some((field) => includesNormalized(field, token))) {
      count += 1;
    }
  }
  return count;
}

export type SearchScoreReason = {
  field: string;
  token: string;
  weight: number;
  reason: string;
};

export function addReason(
  reasons: SearchScoreReason[],
  field: string,
  token: string,
  weight: number,
  reason: string,
): number {
  reasons.push({ field, token, weight, reason });
  return weight;
}
