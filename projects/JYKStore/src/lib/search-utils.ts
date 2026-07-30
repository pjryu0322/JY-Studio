/** Source (raw) query tokens kept before synonym expansion. */
export const SOURCE_TOKEN_BUDGET = 12;
/** Synonym expansions allowed after source tokens are filled. */
export const EXPANSION_TOKEN_BUDGET = 8;

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
  // Avoid bare 은/는/이/가 — they destroy adjectives/verbs (같은→같, 보여주는→보여주).
  "을",
  "를",
  "의",
  "에",
  "로",
  "나",
  "도",
  "만",
  // Do not strip bare 께 — destroys 함께 → 함.
  "할",
] as const;

/**
 * Conversational filler only — never product/domain vocabulary.
 * Domain tokens (api/grid/cell/rmate/…) are classified separately, not dropped.
 */
const CONVERSATIONAL_STOPWORDS = new Set([
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
  "싶어",
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
  "and",
  "or",
  "of",
]);

/**
 * Domain vocabulary kept in the query (P8.1.1).
 * Alone they are weak lexical signals; with CORE terms they stay useful.
 */
const DOMAIN_TERMS = new Set([
  "api",
  "apis",
  "grid",
  "grids",
  "cell",
  "cells",
  "rmate",
  "rmategrid",
  "html5",
  "셀",
]);

/** Small bilingual expansions for common developer terms (query-side only). */
const QUERY_SYNONYMS: Record<string, readonly string[]> = {
  병합: ["merge", "merging"],
  merge: ["병합"],
  merging: ["병합"],
  합치: ["merge", "merging", "병합"],
  합쳐: ["merge", "merging", "병합"],
  합쳐서: ["merge", "merging", "병합"],
  묶: ["merge", "merging", "병합"],
  묶어서: ["merge", "merging", "병합"],
  묶는: ["merge", "merging", "병합"],
  인접한: ["merge", "merging", "병합"],
  반복되는: ["merge", "merging", "병합"],
  연속된: ["merge", "merging", "병합"],
  이어: ["merge", "merging", "병합"],
  이어주는: ["merge", "merging", "병합"],
  하나처럼: ["merge", "merging", "병합"],
  이벤트: ["event"],
  event: ["이벤트"],
  속성: ["property", "properties", "attribute"],
  property: ["속성"],
  properties: ["속성"],
  칸: ["cell", "cells", "셀"],
  칸들: ["칸", "cell", "cells", "셀"],
  이어지는: ["merge", "merging", "병합"],
  영역처럼: ["merge", "merging", "병합"],
  area: ["merge", "merging", "병합"],
  줄: ["rowspan", "span"],
  스타일: ["style"],
  객체: ["object", "attribute"],
  객체는: ["object", "attribute"],
};

export type QueryTokenKind = "CORE_TERM" | "DOMAIN_TERM" | "FILLER_TERM";

export type TokenizeSearchQueryResult = {
  sourceTokens: string[];
  expansionTokens: string[];
  /** Tokens used for lexical DB prefilter (excludes domain-only queries' domain flood). */
  lexicalPrefilterTokens: string[];
  /** All tokens for keyword scoring (source + expansions). */
  scoringTokens: string[];
  truncatedSource: string[];
  truncatedExpansion: string[];
  kinds: Record<string, QueryTokenKind>;
};

function hasHangul(value: string): boolean {
  return /[가-힣]/.test(value);
}

export function classifyQueryToken(token: string): QueryTokenKind {
  if (CONVERSATIONAL_STOPWORDS.has(token)) return "FILLER_TERM";
  if (DOMAIN_TERMS.has(token)) return "DOMAIN_TERM";
  return "CORE_TERM";
}

/**
 * Lexical score multiplier by token kind.
 * Domain terms stay searchable but do not dominate Index/TOC pages alone.
 */
export function queryTokenScoreWeight(token: string): number {
  const kind = classifyQueryToken(token);
  if (kind === "DOMAIN_TERM") return 0.35;
  if (kind === "FILLER_TERM") return 0;
  return 1;
}

/**
 * Strip one trailing Korean particle from a query token.
 * Applied to query tokenization only — never rewrites stored chunk text.
 */
export function stripKoreanQuerySuffix(token: string): string {
  if (!token) return token;

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
    // Allow length-1 Hangul stems (e.g. 칸을 → 칸) used as domain/core cues.
    if (stem.length >= 1 && hasHangul(stem)) {
      token = stem;
      break;
    }
  }

  // Plural marker: 칸들 → 칸 (after particle strip of 칸들을).
  if (token.endsWith("들") && token.length >= 3 && hasHangul(token.slice(0, -1))) {
    token = token.slice(0, -1);
  }

  return token;
}

export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[\t\n\r]+/g, " ")
    .replace(/[()[\]{}.,;:|/\\?!'"]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Soft topic-marker strip used only for stopword matching (not token mutation). */
const STOPWORD_TOPIC_MARKERS = ["은", "는", "이", "가", "을", "를"] as const;

function isConversationalStopword(token: string): boolean {
  if (CONVERSATIONAL_STOPWORDS.has(token)) return true;
  // 기능은/방법은 keep the topic marker after we stopped stripping bare 은/는.
  for (const marker of STOPWORD_TOPIC_MARKERS) {
    if (!token.endsWith(marker) || token.length <= marker.length + 1) continue;
    const stem = token.slice(0, -marker.length);
    if (CONVERSATIONAL_STOPWORDS.has(stem)) return true;
  }
  return false;
}

function isKeepableToken(token: string): boolean {
  if (!token) return false;
  if (isConversationalStopword(token)) return false;
  const isShortAllowed =
    token.length === 1 && (/[0-9a-z]/.test(token) || hasHangul(token));
  if (token.length < 2 && !isShortAllowed) return false;
  return true;
}

/**
 * Detailed tokenize: source tokens fill first, then synonym expansions —
 * expansions never steal budget from remaining source terms.
 */
export function tokenizeSearchQueryDetailed(
  query: string | null | undefined,
): TokenizeSearchQueryResult {
  const normalized = normalizeSearchText(query);
  const empty: TokenizeSearchQueryResult = {
    sourceTokens: [],
    expansionTokens: [],
    lexicalPrefilterTokens: [],
    scoringTokens: [],
    truncatedSource: [],
    truncatedExpansion: [],
    kinds: {},
  };
  if (!normalized) return empty;

  const seen = new Set<string>();
  const sourceTokens: string[] = [];
  const truncatedSource: string[] = [];
  const kinds: Record<string, QueryTokenKind> = {};

  for (const raw of normalized.split(" ")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const token = stripKoreanQuerySuffix(trimmed);
    if (!isKeepableToken(token)) continue;
    if (seen.has(token)) continue;

    if (sourceTokens.length >= SOURCE_TOKEN_BUDGET) {
      truncatedSource.push(token);
      continue;
    }
    seen.add(token);
    sourceTokens.push(token);
    kinds[token] = classifyQueryToken(token);
  }

  const expansionTokens: string[] = [];
  const truncatedExpansion: string[] = [];
  for (const source of sourceTokens) {
    for (const syn of QUERY_SYNONYMS[source] ?? []) {
      if (!isKeepableToken(syn)) continue;
      if (seen.has(syn)) continue;
      if (expansionTokens.length >= EXPANSION_TOKEN_BUDGET) {
        truncatedExpansion.push(syn);
        continue;
      }
      seen.add(syn);
      expansionTokens.push(syn);
      kinds[syn] = classifyQueryToken(syn);
    }
  }

  const scoringTokens = [...sourceTokens, ...expansionTokens];
  const hasCore = sourceTokens.some((t) => classifyQueryToken(t) === "CORE_TERM");
  // Domain terms stay in scoringTokens (weighted) but do not drive lexical DB prefilter
  // when CORE terms exist — prevents api/grid/cell/rmate from flooding Index/DataGrid.
  // Synonym expansions also stay out of lexical prefilter: they score after union so
  // vector-only paraphrase recovery is not short-circuited by merge/cell flood.
  // Domain-only queries: empty lexical prefilter (hybrid/vector supplies recall).
  const lexicalPrefilterTokens = hasCore
    ? sourceTokens.filter((t) => classifyQueryToken(t) === "CORE_TERM")
    : [];

  return {
    sourceTokens,
    expansionTokens,
    lexicalPrefilterTokens,
    scoringTokens,
    truncatedSource,
    truncatedExpansion,
    kinds,
  };
}

export function tokenizeSearchQuery(query: string | null | undefined): string[] {
  return tokenizeSearchQueryDetailed(query).scoringTokens;
}

/**
 * Query text for runtime embedding: original query plus bilingual synonym
 * expansions. Helps paraphrase/natural-language queries align with indexed
 * EN/KO passage terms without hard-coding product API names.
 */
export function buildHybridQueryEmbeddingText(query: string | null | undefined): string {
  const raw = (query ?? "").trim();
  if (!raw) return "";
  const expansions = tokenizeSearchQueryDetailed(raw).expansionTokens.filter(
    (t) => t.length >= 2,
  );
  if (expansions.length === 0) return raw;
  return `${raw} ${expansions.join(" ")}`.trim();
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
