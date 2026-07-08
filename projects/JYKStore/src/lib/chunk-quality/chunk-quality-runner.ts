import type {
  ChunkQualityChunkInput,
  ChunkQualityChunkMetricDraft,
  ChunkQualityIssueDraft,
  ChunkQualityRunResult,
  ChunkQualitySourceDocumentInput,
  ChunkQualityStatus,
  ChunkQualityStructureSectionInput,
} from "@/lib/chunk-quality/chunk-quality-types";

export const MIN_CHUNK_CHARS = 120;
export const MAX_CHUNK_CHARS = 4000;
export const MIN_TOKEN_ESTIMATE = 30;
export const MAX_TOKEN_ESTIMATE = 1000;
export const DUPLICATE_MIN_NORMALIZED_LENGTH = 80;
export const ORPHAN_FAIL_RATIO = 0.1;
export const DUPLICATE_FAIL_RATIO = 0.1;

export const NEAR_DUPLICATE_JACCARD_THRESHOLD = 0.82;
export const SAME_SECTION_JACCARD_THRESHOLD = 0.72;
export const PREFIX_OVERLAP_THRESHOLD = 0.85;
export const NEAR_DUPLICATE_MIN_LENGTH = 120;
export const MAX_NEAR_DUPLICATE_BUCKET_SIZE = 300;

const SHORT_RELAX_SOURCE_TYPES = new Set(["ERROR_CODE_TABLE", "SAMPLE_CODE"]);

export type NearDuplicateReason = "EXACT" | "JACCARD" | "PREFIX_OVERLAP" | "TITLE_SECTION";

function clampScore(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function tokenEstimate(content: string): number {
  return Math.ceil(content.length / 4);
}

function normalizeContent(content: string): string {
  return content.toLowerCase().replace(/\s+/g, " ").trim();
}

export function contentFingerprint(content: string): string {
  return normalizeContent(content);
}

export function makeWordShingles(content: string, size = 3): Set<string> {
  const words = normalizeContent(content).split(" ").filter(Boolean);
  const shingles = new Set<string>();
  if (words.length === 0) return shingles;
  if (words.length < size) {
    shingles.add(words.join(" "));
    return shingles;
  }
  for (let i = 0; i <= words.length - size; i += 1) {
    shingles.add(words.slice(i, i + size).join(" "));
  }
  return shingles;
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const value of a) {
    if (b.has(value)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function prefixOverlapRatio(a: string, b: string): number {
  const normA = normalizeContent(a);
  const normB = normalizeContent(b);
  const [shorter, longer] = normA.length <= normB.length ? [normA, normB] : [normB, normA];
  if (shorter.length < NEAR_DUPLICATE_MIN_LENGTH) return 0;
  if (longer.startsWith(shorter)) return 1;
  let match = 0;
  for (let i = 0; i < shorter.length; i += 1) {
    if (longer[i] === shorter[i]) match += 1;
    else break;
  }
  return match / shorter.length;
}

export function suffixOverlapRatio(a: string, b: string): number {
  const normA = normalizeContent(a);
  const normB = normalizeContent(b);
  const [shorter, longer] = normA.length <= normB.length ? [normA, normB] : [normB, normA];
  if (shorter.length < NEAR_DUPLICATE_MIN_LENGTH) return 0;
  if (longer.endsWith(shorter)) return 1;
  let match = 0;
  for (let i = 0; i < shorter.length; i += 1) {
    if (longer[longer.length - 1 - i] !== shorter[shorter.length - 1 - i]) break;
    match += 1;
  }
  return match / shorter.length;
}

function titlesSimilar(a: string, b: string): boolean {
  const ta = normalizeContent(a);
  const tb = normalizeContent(b);
  if (!ta || !tb) return false;
  if (ta === tb) return true;
  if (ta.length >= 4 && tb.includes(ta)) return true;
  if (tb.length >= 4 && ta.includes(tb)) return true;
  return false;
}

function onlyExactDuplicateAllowed(a: ChunkQualityChunkInput, b: ChunkQualityChunkInput): boolean {
  const sectionA = normalizeContent(a.section ?? "");
  const sectionB = normalizeContent(b.section ?? "");
  return a.sourceDocumentId !== b.sourceDocumentId && sectionA !== sectionB;
}

function chunkAllowsNearDuplicate(
  chunk: ChunkQualityChunkInput,
  sourceById: Map<string, ChunkQualitySourceDocumentInput>,
): boolean {
  return !chunkRelaxesShortSize(chunk, sourceById);
}

export function isNearDuplicateChunk(
  a: ChunkQualityChunkInput,
  b: ChunkQualityChunkInput,
  sourceById: Map<string, ChunkQualitySourceDocumentInput>,
): { duplicate: boolean; reason: NearDuplicateReason | null; score: number } {
  const normA = normalizeContent(a.content);
  const normB = normalizeContent(b.content);

  if (normA === normB && normA.length >= DUPLICATE_MIN_NORMALIZED_LENGTH) {
    return { duplicate: true, reason: "EXACT", score: 1 };
  }

  const relaxOnly =
    !chunkAllowsNearDuplicate(a, sourceById) || !chunkAllowsNearDuplicate(b, sourceById);
  if (relaxOnly) {
    return { duplicate: false, reason: null, score: 0 };
  }

  if (onlyExactDuplicateAllowed(a, b)) {
    return { duplicate: false, reason: null, score: 0 };
  }

  if (normA.length < NEAR_DUPLICATE_MIN_LENGTH || normB.length < NEAR_DUPLICATE_MIN_LENGTH) {
    return { duplicate: false, reason: null, score: 0 };
  }

  if (
    a.sourceDocumentId &&
    a.sourceDocumentId === b.sourceDocumentId &&
    normalizeContent(a.section ?? "") &&
    normalizeContent(a.section ?? "") === normalizeContent(b.section ?? "") &&
    titlesSimilar(a.title, b.title)
  ) {
    const titleJac = jaccardSimilarity(makeWordShingles(normA), makeWordShingles(normB));
    if (titleJac >= SAME_SECTION_JACCARD_THRESHOLD) {
      return { duplicate: true, reason: "TITLE_SECTION", score: titleJac };
    }
  }

  const overlap = Math.max(prefixOverlapRatio(normA, normB), suffixOverlapRatio(normA, normB));
  if (overlap >= PREFIX_OVERLAP_THRESHOLD) {
    return { duplicate: true, reason: "PREFIX_OVERLAP", score: overlap };
  }

  const jac = jaccardSimilarity(makeWordShingles(normA), makeWordShingles(normB));
  if (jac >= NEAR_DUPLICATE_JACCARD_THRESHOLD) {
    return { duplicate: true, reason: "JACCARD", score: jac };
  }

  return { duplicate: false, reason: null, score: 0 };
}

function duplicateIssueCode(reason: NearDuplicateReason): string {
  switch (reason) {
    case "EXACT":
      return "CHUNK_DUPLICATE_EXACT";
    case "JACCARD":
      return "CHUNK_DUPLICATE_NEAR";
    case "PREFIX_OVERLAP":
      return "CHUNK_DUPLICATE_PREFIX_OVERLAP";
    case "TITLE_SECTION":
      return "CHUNK_DUPLICATE_TITLE_SECTION";
    default:
      return "CHUNK_DUPLICATE_NEAR";
  }
}

function duplicateIssueMessage(reason: NearDuplicateReason): string {
  switch (reason) {
    case "EXACT":
      return "동일한 본문의 chunk가 반복되어 있습니다.";
    case "JACCARD":
      return "유사도가 높은 chunk가 반복되어 있습니다.";
    case "PREFIX_OVERLAP":
      return "본문 prefix/suffix가 크게 겹치는 chunk가 있습니다.";
    case "TITLE_SECTION":
      return "동일 제목·section의 유사 chunk가 있습니다.";
    default:
      return "유사한 chunk가 반복되어 있습니다.";
  }
}

function duplicateHint(
  repId: string,
  otherId: string,
  reason: NearDuplicateReason,
  score: number,
): string {
  const label =
    reason === "EXACT"
      ? "EXACT"
      : reason === "PREFIX_OVERLAP"
        ? "PREFIX_OVERLAP"
        : reason === "TITLE_SECTION"
          ? "TITLE_SECTION"
          : "JACCARD";
  return `${otherId}와 ${label} ${score.toFixed(2)} 유사도입니다. 두 chunk를 병합하거나 범위를 분리하세요.`;
}

function buildDuplicateBuckets(chunks: ChunkQualityChunkInput[]): Map<string, ChunkQualityChunkInput[]> {
  const buckets = new Map<string, ChunkQualityChunkInput[]>();
  const add = (key: string, chunk: ChunkQualityChunkInput) => {
    const list = buckets.get(key) ?? [];
    list.push(chunk);
    buckets.set(key, list);
  };
  for (const chunk of chunks) {
    if (!chunk.sourceDocumentId) continue;
    add(`source:${chunk.sourceDocumentId}`, chunk);
    const section = normalizeContent(chunk.section ?? "");
    if (section) {
      add(`section:${section}`, chunk);
    }
  }
  return buckets;
}

function pickRepresentativeId(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function detectDuplicateChunks(
  activeChunks: ChunkQualityChunkInput[],
  sourceById: Map<string, ChunkQualitySourceDocumentInput>,
): {
  duplicateChunkCount: number;
  issues: ChunkQualityIssueDraft[];
  codesByChunkId: Map<string, string[]>;
} {
  const duplicateChunkIds = new Set<string>();
  const issues: ChunkQualityIssueDraft[] = [];
  const codesByChunkId = new Map<string, string[]>();
  const seenPairs = new Set<string>();

  const addDuplicatePair = (
    repId: string,
    followerId: string,
    reason: NearDuplicateReason,
    score: number,
  ) => {
    duplicateChunkIds.add(followerId);
    const code = duplicateIssueCode(reason);
    const repCodes = codesByChunkId.get(repId) ?? [];
    if (!repCodes.includes(code)) repCodes.push(code);
    codesByChunkId.set(repId, repCodes);
    const followerCodes = codesByChunkId.get(followerId) ?? [];
    if (!followerCodes.includes(code)) followerCodes.push(code);
    codesByChunkId.set(followerId, followerCodes);

    const pairKey = `${repId}:${followerId}:${code}`;
    if (seenPairs.has(pairKey)) return;
    seenPairs.add(pairKey);

    issues.push({
      severity: "WARNING",
      code,
      message: duplicateIssueMessage(reason),
      field: repId,
      hint: duplicateHint(repId, followerId, reason, score),
    });
  };

  const exactGroups = new Map<string, string[]>();
  for (const chunk of activeChunks) {
    const normalized = normalizeContent(chunk.content);
    if (normalized.length < DUPLICATE_MIN_NORMALIZED_LENGTH) continue;
    const list = exactGroups.get(normalized) ?? [];
    list.push(chunk.id);
    exactGroups.set(normalized, list);
  }

  for (const ids of exactGroups.values()) {
    if (ids.length <= 1) continue;
    const sorted = [...ids].sort();
    const repId = sorted[0]!;
    for (let i = 1; i < sorted.length; i += 1) {
      addDuplicatePair(repId, sorted[i]!, "EXACT", 1);
    }
  }

  const buckets = buildDuplicateBuckets(activeChunks);
  for (const bucket of buckets.values()) {
    const list = bucket.slice(0, MAX_NEAR_DUPLICATE_BUCKET_SIZE);
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i]!;
        const b = list[j]!;
        const [repId, followerId] = pickRepresentativeId(a.id, b.id);
        const result = isNearDuplicateChunk(a, b, sourceById);
        if (!result.duplicate || !result.reason) continue;
        if (result.reason === "EXACT") continue;
        addDuplicatePair(repId, followerId, result.reason, result.score);
      }
    }
  }

  return {
    duplicateChunkCount: duplicateChunkIds.size,
    issues,
    codesByChunkId,
  };
}

function isEligibleSource(doc: ChunkQualitySourceDocumentInput): boolean {
  return doc.validationStatus === "PASS" || doc.validationStatus === "WARNING";
}

function chunkRelaxesShortSize(
  chunk: ChunkQualityChunkInput,
  sourceById: Map<string, ChunkQualitySourceDocumentInput>,
): boolean {
  if (SHORT_RELAX_SOURCE_TYPES.has(chunk.chunkType)) return true;
  if (!chunk.sourceDocumentId) return false;
  const doc = sourceById.get(chunk.sourceDocumentId);
  return doc ? SHORT_RELAX_SOURCE_TYPES.has(doc.sourceType) : false;
}

function chunkAlignsWithSection(
  chunk: ChunkQualityChunkInput,
  section: ChunkQualityStructureSectionInput,
): boolean {
  if (chunk.sourceDocumentId && section.matchedDocIds.includes(chunk.sourceDocumentId)) {
    return true;
  }
  const haystack = [chunk.title, chunk.section ?? "", chunk.content, ...chunk.tags]
    .join(" ")
    .toLowerCase();
  const key = section.sectionKey.toLowerCase();
  const title = section.title.toLowerCase();
  if (haystack.includes(key) || haystack.includes(title)) {
    return true;
  }
  for (const signal of section.matchedSignals) {
    const part = signal.includes(":") ? signal.split(":").slice(1).join(":") : signal;
    if (part && haystack.includes(part.toLowerCase())) {
      return true;
    }
  }
  return false;
}

function metricStatusFromIssues(issueCodes: string[]): ChunkQualityStatus {
  if (issueCodes.some((c) => c.startsWith("EMPTY") || c.includes("BLOCKER"))) {
    return "FAIL";
  }
  if (issueCodes.length > 0) return "WARNING";
  return "PASS";
}

export function runChunkQuality(input: {
  sources: ChunkQualitySourceDocumentInput[];
  chunks: ChunkQualityChunkInput[];
  structureSections: ChunkQualityStructureSectionInput[];
}): ChunkQualityRunResult {
  const issues: ChunkQualityIssueDraft[] = [];
  const metrics: ChunkQualityChunkMetricDraft[] = [];

  const sourceById = new Map(input.sources.map((s) => [s.id, s]));
  const eligibleSources = input.sources.filter(isEligibleSource);
  const activeChunks = input.chunks.filter((c) => c.isActive);
  const inactiveChunkCount = input.chunks.length - activeChunks.length;

  const activeBySource = new Map<string, number>();
  for (const chunk of activeChunks) {
    if (!chunk.sourceDocumentId) continue;
    activeBySource.set(
      chunk.sourceDocumentId,
      (activeBySource.get(chunk.sourceDocumentId) ?? 0) + 1,
    );
  }

  let coveredSourceDocumentCount = 0;
  let missingSourceChunkCount = 0;
  for (const source of eligibleSources) {
    if ((activeBySource.get(source.id) ?? 0) > 0) {
      coveredSourceDocumentCount += 1;
    } else {
      missingSourceChunkCount += 1;
      issues.push({
        severity: "BLOCKER",
        code: "CHUNK_SOURCE_COVERAGE_MISSING",
        message: "chunk가 생성되지 않은 원천 문서가 있습니다.",
        field: source.id,
        hint: "해당 원천 문서에서 chunk를 생성하세요.",
      });
    }
  }

  if (eligibleSources.length === 0) {
    issues.push({
      severity: "BLOCKER",
      code: "CHUNK_NO_ELIGIBLE_SOURCE",
      message: "검증 통과(PASS/WARNING) 원천 문서가 없어 chunk 커버리지를 평가할 수 없습니다.",
    });
  }

  let orphanChunkCount = 0;
  let invalidReferenceCount = 0;
  for (const chunk of activeChunks) {
    if (!chunk.sourceDocumentId) {
      orphanChunkCount += 1;
      issues.push({
        severity: "WARNING",
        code: "CHUNK_ORPHAN",
        message: "원천 문서와 연결되지 않은 chunk가 있습니다.",
        field: chunk.id,
      });
    } else if (!sourceById.has(chunk.sourceDocumentId)) {
      invalidReferenceCount += 1;
      issues.push({
        severity: "BLOCKER",
        code: "CHUNK_INVALID_SOURCE_REFERENCE",
        message: "존재하지 않는 원천 문서를 참조하는 chunk가 있습니다.",
        field: chunk.id,
      });
    }
  }

  const orphanRatio =
    activeChunks.length > 0 ? orphanChunkCount / activeChunks.length : 0;
  if (orphanRatio > ORPHAN_FAIL_RATIO) {
    issues.push({
      severity: "BLOCKER",
      code: "CHUNK_ORPHAN_RATIO_HIGH",
      message: "원천 문서 없이 연결된 chunk 비율이 10%를 초과합니다.",
    });
  }

  let shortChunkCount = 0;
  let longChunkCount = 0;
  let emptyChunkCount = 0;

  for (const chunk of activeChunks) {
    const trimmed = chunk.content.trim();
    const len = trimmed.length;
    const chunkIssues: string[] = [];

    if (len === 0 || !chunk.title.trim()) {
      emptyChunkCount += 1;
      if (len === 0) {
        chunkIssues.push("EMPTY_CHUNK");
        issues.push({
          severity: "BLOCKER",
          code: "EMPTY_CHUNK",
          message: "내용이 비어 있는 chunk가 있습니다.",
          field: chunk.id,
        });
      }
      if (!chunk.title.trim()) {
        chunkIssues.push("CHUNK_TITLE_MISSING");
        issues.push({
          severity: "BLOCKER",
          code: "CHUNK_TITLE_MISSING",
          message: "제목이 없는 chunk가 있습니다.",
          field: chunk.id,
        });
      }
    } else {
      const relaxShort = chunkRelaxesShortSize(chunk, sourceById);
      if (!relaxShort && len < MIN_CHUNK_CHARS) {
        shortChunkCount += 1;
        chunkIssues.push("SHORT_CHUNK");
        issues.push({
          severity: "WARNING",
          code: "SHORT_CHUNK",
          message: "내용이 짧은 chunk가 있습니다.",
          field: chunk.id,
        });
      }
      if (len > MAX_CHUNK_CHARS) {
        longChunkCount += 1;
        chunkIssues.push("LONG_CHUNK");
        issues.push({
          severity: "WARNING",
          code: "LONG_CHUNK",
          message: "내용이 긴 chunk가 있습니다.",
          field: chunk.id,
        });
      }
      const tokens = tokenEstimate(trimmed);
      if (!relaxShort && tokens < MIN_TOKEN_ESTIMATE) {
        if (!chunkIssues.includes("SHORT_CHUNK")) {
          shortChunkCount += 1;
          chunkIssues.push("SHORT_CHUNK");
        }
      }
      if (tokens > MAX_TOKEN_ESTIMATE && !chunkIssues.includes("LONG_CHUNK")) {
        longChunkCount += 1;
        chunkIssues.push("LONG_CHUNK");
      }
    }

    let metadataIssues = 0;
    if (!chunk.section?.trim()) {
      metadataIssues += 1;
      issues.push({
        severity: "WARNING",
        code: "CHUNK_SECTION_MISSING",
        message: "section이 없는 chunk가 있습니다.",
        field: chunk.id,
      });
      chunkIssues.push("CHUNK_SECTION_MISSING");
    }
    if (chunk.tags.length === 0) {
      metadataIssues += 1;
      issues.push({
        severity: "WARNING",
        code: "CHUNK_TAGS_MISSING",
        message: "tags가 없는 chunk가 있습니다.",
        field: chunk.id,
      });
      chunkIssues.push("CHUNK_TAGS_MISSING");
    }
    const hasMetadataObject =
      chunk.metadata !== null &&
      typeof chunk.metadata === "object" &&
      Object.keys(chunk.metadata).length > 0;
    if (!hasMetadataObject) {
      metadataIssues += 1;
      issues.push({
        severity: "WARNING",
        code: "CHUNK_METADATA_MISSING",
        message: "metadata가 없는 chunk가 있습니다.",
        field: chunk.id,
      });
      chunkIssues.push("CHUNK_METADATA_MISSING");
    }

    const chunkScore = clampScore(100 - metadataIssues * 8 - chunkIssues.length * 15);
    metrics.push({
      chunkId: chunk.id,
      sourceDocumentId: chunk.sourceDocumentId,
      title: chunk.title,
      contentLength: len,
      tokenEstimate: tokenEstimate(trimmed),
      status: metricStatusFromIssues(chunkIssues),
      score: chunkScore,
      issues: chunkIssues,
    });
  }

  const duplicateResult = detectDuplicateChunks(activeChunks, sourceById);
  for (const metric of metrics) {
    const dupCodes = duplicateResult.codesByChunkId.get(metric.chunkId);
    if (!dupCodes?.length) continue;
    for (const code of dupCodes) {
      if (!metric.issues.includes(code)) metric.issues.push(code);
    }
    if (metric.status === "PASS" && dupCodes.length > 0) {
      metric.status = "WARNING";
    }
  }
  issues.push(...duplicateResult.issues);
  const duplicateChunkCount = duplicateResult.duplicateChunkCount;

  const duplicateRatio =
    activeChunks.length > 0 ? duplicateChunkCount / activeChunks.length : 0;
  if (duplicateRatio > DUPLICATE_FAIL_RATIO) {
    issues.push({
      severity: "BLOCKER",
      code: "CHUNK_DUPLICATE_RATIO_HIGH",
      message: "중복 chunk 비율이 10%를 초과합니다.",
    });
  }

  const requiredCoveredSections = input.structureSections.filter(
    (s) => s.required && s.covered,
  );
  let alignedRequired = 0;
  for (const section of requiredCoveredSections) {
    const hasChunk = activeChunks.some((chunk) => chunkAlignsWithSection(chunk, section));
    if (hasChunk) {
      alignedRequired += 1;
    } else {
      issues.push({
        severity: "WARNING",
        code: "CHUNK_STRUCTURE_SECTION_MISSING",
        message: `구조 필수 섹션 '${section.title}'과 연결된 chunk가 없습니다.`,
        field: section.sectionKey,
      });
    }
  }

  const chunkWithoutMetadataCount = metrics.filter((m) =>
    m.issues.some(
      (code) =>
        code === "CHUNK_SECTION_MISSING" ||
        code === "CHUNK_TAGS_MISSING" ||
        code === "CHUNK_METADATA_MISSING",
    ),
  ).length;

  let coverageScore = 100;
  if (eligibleSources.length === 0) {
    coverageScore = 0;
  } else {
    coverageScore = clampScore(
      (coveredSourceDocumentCount / eligibleSources.length) * 100,
    );
  }

  let traceabilityScore = 100;
  if (activeChunks.length > 0) {
    const bad = orphanChunkCount + invalidReferenceCount;
    traceabilityScore = clampScore(100 - (bad / activeChunks.length) * 100);
  } else if (eligibleSources.length > 0) {
    traceabilityScore = 0;
  }

  let sizeScore = 100;
  if (activeChunks.length > 0) {
    const sizeProblems = emptyChunkCount + shortChunkCount + longChunkCount;
    sizeScore = clampScore(100 - (sizeProblems / activeChunks.length) * 100);
  } else {
    sizeScore = 0;
  }

  let duplicateScore = 100;
  if (activeChunks.length > 0) {
    duplicateScore = clampScore(100 - duplicateRatio * 100);
  }

  let metadataScore = 100;
  if (activeChunks.length > 0) {
    metadataScore = clampScore(
      100 - (chunkWithoutMetadataCount / activeChunks.length) * 100,
    );
  } else {
    metadataScore = 0;
  }

  let structureAlignmentScore = 100;
  if (requiredCoveredSections.length > 0) {
    structureAlignmentScore = clampScore(
      (alignedRequired / requiredCoveredSections.length) * 100,
    );
  }

  const totalScore = clampScore(
    coverageScore * 0.25 +
      traceabilityScore * 0.2 +
      sizeScore * 0.2 +
      duplicateScore * 0.15 +
      metadataScore * 0.1 +
      structureAlignmentScore * 0.1,
  );

  const dedupedIssues = dedupeIssues(issues);
  const blockingIssueCount = dedupedIssues.filter((i) => i.severity === "BLOCKER").length;
  const warningIssueCount = dedupedIssues.filter((i) => i.severity === "WARNING").length;

  const status = determineOverallStatus({
    totalScore,
    blockingIssueCount,
    warningIssueCount,
    activeChunkCount: activeChunks.length,
    missingSourceChunkCount,
    orphanRatio,
    duplicateRatio,
    emptyChunkCount,
  });

  const summary = buildSummary({
    status,
    totalScore,
    activeChunkCount: activeChunks.length,
    coveredSourceDocumentCount,
    eligibleSourceCount: eligibleSources.length,
    orphanChunkCount,
    duplicateChunkCount,
  });

  return {
    status,
    totalScore,
    coverageScore,
    traceabilityScore,
    sizeScore,
    duplicateScore,
    metadataScore,
    structureAlignmentScore,
    activeChunkCount: activeChunks.length,
    inactiveChunkCount,
    sourceDocumentCount: eligibleSources.length,
    coveredSourceDocumentCount,
    orphanChunkCount,
    missingSourceChunkCount,
    shortChunkCount,
    longChunkCount,
    duplicateChunkCount,
    chunkWithoutMetadataCount,
    blockingIssueCount,
    warningIssueCount,
    summary,
    issues: dedupedIssues,
    metrics,
  };
}

function dedupeIssues(issues: ChunkQualityIssueDraft[]): ChunkQualityIssueDraft[] {
  const seen = new Set<string>();
  const out: ChunkQualityIssueDraft[] = [];
  for (const issue of issues) {
    const key = `${issue.code}:${issue.field ?? ""}:${issue.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(issue);
  }
  return out;
}

function determineOverallStatus(input: {
  totalScore: number;
  blockingIssueCount: number;
  warningIssueCount: number;
  activeChunkCount: number;
  missingSourceChunkCount: number;
  orphanRatio: number;
  duplicateRatio: number;
  emptyChunkCount: number;
}): ChunkQualityStatus {
  if (input.activeChunkCount === 0) return "FAIL";
  if (input.emptyChunkCount > 0) return "FAIL";
  if (input.missingSourceChunkCount > 0) return "FAIL";
  if (input.orphanRatio > ORPHAN_FAIL_RATIO) return "FAIL";
  if (input.duplicateRatio > DUPLICATE_FAIL_RATIO) return "FAIL";
  if (input.blockingIssueCount > 0) return "FAIL";
  if (input.totalScore < 70) return "FAIL";
  if (input.totalScore < 85 || input.warningIssueCount > 0) return "WARNING";
  return "PASS";
}

function buildSummary(input: {
  status: ChunkQualityStatus;
  totalScore: number;
  activeChunkCount: number;
  coveredSourceDocumentCount: number;
  eligibleSourceCount: number;
  orphanChunkCount: number;
  duplicateChunkCount: number;
}): string {
  return [
    `청킹 품질 ${input.status} (총점 ${input.totalScore})`,
    `active chunk ${input.activeChunkCount}개`,
    `원천 커버리지 ${input.coveredSourceDocumentCount}/${input.eligibleSourceCount}`,
    `orphan ${input.orphanChunkCount}, duplicate ${input.duplicateChunkCount}`,
  ].join(" · ");
}

/** @internal test helper */
export function classifyChunkQualitySubmitAllowed(status: ChunkQualityStatus): boolean {
  return status === "PASS" || status === "WARNING";
}
