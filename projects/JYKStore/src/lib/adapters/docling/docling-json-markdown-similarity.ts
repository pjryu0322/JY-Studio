/**
 * @deprecated Semantic JSON↔Markdown similarity is no longer a registration hard gate.
 * Module kept for legacy report tooling / extractJsonTextSamples used by stream projector.
 * New validations must not call `compareJsonMarkdownSimilarity`.
 */
import { filenameMatchFingerprint } from "./docling-origin-matcher";
import {
  DOCLING_ERROR_CODES,
  issue,
  type DoclingIssue,
} from "./docling-errors";
import type { DoclingDocument } from "./docling-types";
import { DOCLING_MARKDOWN_VALIDATOR_VERSION } from "./docling-markdown-validator";

export { DOCLING_MARKDOWN_VALIDATOR_VERSION };

export type JsonMarkdownSimilarityMetrics = {
  jsonTokenCount: number;
  markdownTokenCount: number;
  commonTokenCount: number;
  jaccard: number;
  markdownCoverage: number;
  jsonCoverage: number;
  charNgramSimilarity: number | null;
  sampleCount: number;
  passedSampleCount: number;
  originFileNameMatched: boolean | null;
  titleMatched: boolean | null;
};

export type TextSamples = { start: string; middle: string; end: string };

export type SimilaritySampleDetail = {
  label: "start" | "middle" | "end";
  markdownCoverage: number;
  charNgramSimilarity: number | null;
  passed: boolean;
};

export type JsonMarkdownSimilarityResult = {
  verdict: "PASS" | "WARNING" | "ERROR";
  metrics: JsonMarkdownSimilarityMetrics;
  samples: SimilaritySampleDetail[];
  issues: DoclingIssue[];
};

const DEFAULT_MAX_TOKENS = 20_000;
const DEFAULT_SAMPLE_BYTES = 65_536;
const DEFAULT_SAMPLE_COUNT = 3;
const DEFAULT_CHAR_NGRAM_MAX_ITEMS = 50_000;

function envInt(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
): number {
  const raw = env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function resolveSimilarityMaxTokens(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return envInt(env, "DOCLING_SIMILARITY_MAX_TOKENS", DEFAULT_MAX_TOKENS);
}

export function resolveSimilaritySampleBytes(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return envInt(env, "DOCLING_SIMILARITY_SAMPLE_BYTES", DEFAULT_SAMPLE_BYTES);
}

export function resolveSimilaritySampleCount(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return Math.min(
    envInt(env, "DOCLING_SIMILARITY_SAMPLE_COUNT", DEFAULT_SAMPLE_COUNT),
    3,
  );
}

export function resolveCharNgramMaxItems(
  env: NodeJS.ProcessEnv = process.env,
): number {
  return envInt(env, "DOCLING_CHAR_NGRAM_MAX_ITEMS", DEFAULT_CHAR_NGRAM_MAX_ITEMS);
}

/** NFKC, lower, strip punctuation, collapse spaces; strip markdown table pipes/alignment. */
export function normalizeForSimilarity(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\|/g, " ")
    .replace(/:-{2,}|-{2,}:|:-{2,}:/g, " ")
    .replace(/-{3,}/g, " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Word tokens length >= 2, capped by env. */
export function tokenizeForSimilarity(
  text: string,
  maxTokens = resolveSimilarityMaxTokens(),
): string[] {
  const normalized = normalizeForSimilarity(text);
  if (!normalized) return [];
  const tokens: string[] = [];
  for (const t of normalized.split(" ")) {
    if (t.length < 2) continue;
    tokens.push(t);
    if (tokens.length >= maxTokens) break;
  }
  return tokens;
}

function tokenSet(tokens: string[]): Set<string> {
  return new Set(tokens);
}

function setIntersectionSize(a: Set<string>, b: Set<string>): number {
  let n = 0;
  const smaller = a.size <= b.size ? a : b;
  const larger = a.size <= b.size ? b : a;
  for (const t of smaller) {
    if (larger.has(t)) n += 1;
  }
  return n;
}

function jaccardSets(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  const inter = setIntersectionSize(a, b);
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Compact text without spaces; capped n-gram set Jaccard. */
export function charNgramSimilarity(
  a: string,
  b: string,
  n = 3,
  maxItems = resolveCharNgramMaxItems(),
): number | null {
  const ca = normalizeForSimilarity(a).replace(/\s+/g, "");
  const cb = normalizeForSimilarity(b).replace(/\s+/g, "");
  if (ca.length < n || cb.length < n) return null;

  const setA = new Set<string>();
  const setB = new Set<string>();
  for (let i = 0; i <= ca.length - n && setA.size < maxItems; i++) {
    setA.add(ca.slice(i, i + n));
  }
  for (let i = 0; i <= cb.length - n && setB.size < maxItems; i++) {
    setB.add(cb.slice(i, i + n));
  }
  return jaccardSets(setA, setB);
}

function sliceByCharBudget(text: string, maxBytes: number): string {
  if (!text) return "";
  const encoder = new TextEncoder();
  if (encoder.encode(text).byteLength <= maxBytes) return text;
  // Approximate: walk code points until near budget
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (encoder.encode(text.slice(0, mid)).byteLength <= maxBytes) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo);
}

function corpusFromDocument(doc: DoclingDocument): string {
  const parts: string[] = [];
  if (typeof doc.name === "string" && doc.name.trim()) parts.push(doc.name);
  if (Array.isArray(doc.texts)) {
    for (const item of doc.texts) {
      if (item && typeof item.text === "string" && item.text.trim()) {
        parts.push(item.text);
      }
    }
  }
  return parts.join("\n");
}

/** Join texts into corpus then split into start/middle/end thirds. */
export function extractJsonTextSamples(
  doc: DoclingDocument,
  sampleBytes = resolveSimilaritySampleBytes(),
): TextSamples {
  const corpus = corpusFromDocument(doc);
  return buildTextSamples(corpus, sampleBytes);
}

/** Build start / middle / end windows from a single text. */
export function buildTextSamples(
  text: string,
  sampleBytes = resolveSimilaritySampleBytes(),
): TextSamples {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  if (bytes.byteLength === 0) {
    return { start: "", middle: "", end: "" };
  }

  if (bytes.byteLength <= sampleBytes * 3) {
    const third = Math.max(1, Math.ceil(text.length / 3));
    return {
      start: text.slice(0, third),
      middle: text.slice(third, third * 2),
      end: text.slice(third * 2),
    };
  }

  const decoder = new TextDecoder("utf-8", { fatal: false });
  const startBuf = bytes.subarray(0, Math.min(sampleBytes, bytes.byteLength));
  const endStart = Math.max(0, bytes.byteLength - sampleBytes);
  const endBuf = bytes.subarray(endStart);
  const midCenter = Math.floor(bytes.byteLength / 2);
  const midStart = Math.max(0, midCenter - Math.floor(sampleBytes / 2));
  const midEnd = Math.min(bytes.byteLength, midStart + sampleBytes);
  const middleBuf = bytes.subarray(midStart, midEnd);

  return {
    start: decoder.decode(startBuf),
    middle: decoder.decode(middleBuf),
    end: decoder.decode(endBuf),
  };
}

function matchFilenameBases(
  originFileName: string | undefined,
  sourceFileName: string | undefined,
): boolean | null {
  if (!originFileName || !sourceFileName) return null;
  const a = filenameMatchFingerprint(originFileName);
  const b = filenameMatchFingerprint(sourceFileName);
  if (!a || !b) return null;
  return a === b || a.includes(b) || b.includes(a);
}

function extractMarkdownTitle(markdown: string): string | null {
  const lines = markdown.split(/\r?\n/);
  for (const line of lines.slice(0, 40)) {
    const m = /^(#{1,3})\s+(.+)$/.exec(line.trim());
    if (m?.[2]) return m[2].trim();
  }
  return null;
}

function titlesMatch(a: string, b: string): boolean {
  const na = normalizeForSimilarity(a).replace(/\s+/g, "");
  const nb = normalizeForSimilarity(b).replace(/\s+/g, "");
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const minLen = Math.min(na.length, nb.length);
  if (minLen < 4) return false;
  let shared = 0;
  while (shared < minLen && na[shared] === nb[shared]) shared += 1;
  return shared / Math.max(na.length, nb.length) >= 0.7;
}

function matchDocumentTitle(
  document: DoclingDocument | undefined,
  markdownSamples: TextSamples,
): boolean | null {
  const docName = typeof document?.name === "string" ? document.name.trim() : "";
  if (!docName) return null;
  const joined = `${markdownSamples.start}\n${markdownSamples.middle}\n${markdownSamples.end}`;
  const heading = extractMarkdownTitle(joined);
  if (!heading) return null;
  return titlesMatch(docName, heading);
}

function pairMetrics(
  jsonText: string,
  mdText: string,
): {
  markdownCoverage: number;
  jsonCoverage: number;
  jaccard: number;
  commonTokenCount: number;
  jsonTokenCount: number;
  markdownTokenCount: number;
  charNgramSimilarity: number | null;
} {
  const jsonTokens = tokenizeForSimilarity(jsonText);
  const mdTokens = tokenizeForSimilarity(mdText);
  const jsonSet = tokenSet(jsonTokens);
  const mdSet = tokenSet(mdTokens);
  const common = setIntersectionSize(jsonSet, mdSet);
  const jaccard = jaccardSets(jsonSet, mdSet);
  const markdownCoverage =
    mdSet.size === 0 ? 0 : common / mdSet.size;
  const jsonCoverage = jsonSet.size === 0 ? 0 : common / jsonSet.size;
  return {
    markdownCoverage,
    jsonCoverage,
    jaccard,
    commonTokenCount: common,
    jsonTokenCount: jsonSet.size,
    markdownTokenCount: mdSet.size,
    charNgramSimilarity: charNgramSimilarity(jsonText, mdText),
  };
}

function samplePassed(
  markdownCoverage: number,
  ngram: number | null,
): boolean {
  return markdownCoverage >= 0.4 || (ngram != null && ngram >= 0.35);
}

export function compareJsonMarkdownSimilarity(input: {
  jsonSamples: TextSamples;
  markdownSamples: TextSamples;
  document?: DoclingDocument;
  originFileName?: string;
  sourceFileName?: string;
}): JsonMarkdownSimilarityResult {
  const labels = ["start", "middle", "end"] as const;
  const sampleCount = Math.min(3, resolveSimilaritySampleCount());
  const samples: SimilaritySampleDetail[] = [];

  for (let i = 0; i < sampleCount; i++) {
    const label = labels[i]!;
    const jsonPart = input.jsonSamples[label] ?? "";
    const mdPart = input.markdownSamples[label] ?? "";
    const m = pairMetrics(jsonPart, mdPart);
    samples.push({
      label,
      markdownCoverage: m.markdownCoverage,
      charNgramSimilarity: m.charNgramSimilarity,
      passed: samplePassed(m.markdownCoverage, m.charNgramSimilarity),
    });
  }

  const jsonJoined = [input.jsonSamples.start, input.jsonSamples.middle, input.jsonSamples.end]
    .filter(Boolean)
    .join("\n");
  const mdJoined = [
    input.markdownSamples.start,
    input.markdownSamples.middle,
    input.markdownSamples.end,
  ]
    .filter(Boolean)
    .join("\n");

  // Cap joined strings for overall token metrics to avoid blow-ups
  const sampleBytes = resolveSimilaritySampleBytes();
  const overall = pairMetrics(
    sliceByCharBudget(jsonJoined, sampleBytes * 3),
    sliceByCharBudget(mdJoined, sampleBytes * 3),
  );

  const originFileNameMatched = matchFilenameBases(
    input.originFileName ?? input.document?.origin?.filename,
    input.sourceFileName,
  );
  const titleMatched = matchDocumentTitle(input.document, input.markdownSamples);
  const passedSampleCount = samples.filter((s) => s.passed).length;

  const metrics: JsonMarkdownSimilarityMetrics = {
    jsonTokenCount: overall.jsonTokenCount,
    markdownTokenCount: overall.markdownTokenCount,
    commonTokenCount: overall.commonTokenCount,
    jaccard: overall.jaccard,
    markdownCoverage: overall.markdownCoverage,
    jsonCoverage: overall.jsonCoverage,
    charNgramSimilarity: overall.charNgramSimilarity,
    sampleCount: samples.length,
    passedSampleCount,
    originFileNameMatched,
    titleMatched,
  };

  const originOk = originFileNameMatched === true;
  const titleOk = titleMatched === true;
  const originFailOrUnknown =
    originFileNameMatched === false || originFileNameMatched === null;
  const titleFailOrUnknown = titleMatched === false || titleMatched === null;
  const ngram = metrics.charNgramSimilarity;
  const ngramVeryLow = ngram == null || ngram < 0.15;
  const coverageVeryLow = metrics.markdownCoverage < 0.2;
  const allSamplesFail = passedSampleCount === 0;

  const issues: DoclingIssue[] = [];
  let verdict: "PASS" | "WARNING" | "ERROR";

  const passByCoverage = metrics.markdownCoverage >= 0.7;
  const passByMeta =
    originOk && titleOk && passedSampleCount >= 2;

  if (passByCoverage || passByMeta) {
    verdict = "PASS";
  } else if (
    originFailOrUnknown &&
    titleFailOrUnknown &&
    coverageVeryLow &&
    ngramVeryLow &&
    allSamplesFail
  ) {
    verdict = "ERROR";
    issues.push(
      issue(
        DOCLING_ERROR_CODES.DOCLING_JSON_MARKDOWN_MISMATCH,
        "ERROR",
        "Markdown content appears unrelated to Docling JSON text entities.",
        {
          field: "markdown",
          hint: "동일 문서에서 생성된 Docling JSON·Markdown 쌍인지 확인하세요.",
        },
      ),
    );
  } else {
    verdict = "WARNING";
    const inconclusive =
      metrics.markdownCoverage < 0.4 &&
      passedSampleCount <= 1 &&
      !(originOk && titleOk);

    if (inconclusive) {
      issues.push(
        issue(
          DOCLING_ERROR_CODES.DOCLING_JSON_MARKDOWN_INCONCLUSIVE,
          "WARNING",
          "JSON/Markdown similarity is inconclusive for this document size; stored files may still match.",
          {
            field: "markdown",
            hint: "대용량 문서에서는 표본 기반 유사도만 사용합니다. 저장된 파일 재검증을 시도할 수 있습니다.",
          },
        ),
      );
    } else if (metrics.markdownCoverage < 0.7) {
      issues.push(
        issue(
          DOCLING_ERROR_CODES.DOCLING_JSON_MARKDOWN_LOW_COVERAGE,
          "WARNING",
          "Markdown coverage of Docling JSON tokens is moderate or low.",
          { field: "markdown" },
        ),
      );
    }

    // Jaccard is diagnostic only — optional WARNING when also low coverage
    if (metrics.jaccard < 0.02 && metrics.markdownCoverage < 0.4) {
      const already = issues.some(
        (i) =>
          i.code === DOCLING_ERROR_CODES.DOCLING_JSON_MARKDOWN_INCONCLUSIVE ||
          i.code === DOCLING_ERROR_CODES.DOCLING_JSON_MARKDOWN_LOW_COVERAGE,
      );
      if (!already) {
        issues.push(
          issue(
            DOCLING_ERROR_CODES.DOCLING_JSON_MARKDOWN_LOW_COVERAGE,
            "WARNING",
            "Token Jaccard is low; using coverage/ngram/sample evidence instead.",
            { field: "markdown" },
          ),
        );
      }
    }
  }

  return { verdict, metrics, samples, issues };
}
