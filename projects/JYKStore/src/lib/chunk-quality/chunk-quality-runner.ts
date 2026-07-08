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

const SHORT_RELAX_SOURCE_TYPES = new Set(["ERROR_CODE_TABLE", "SAMPLE_CODE"]);

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

  const duplicateGroups = new Map<string, string[]>();
  for (const chunk of activeChunks) {
    const normalized = normalizeContent(chunk.content);
    if (normalized.length < DUPLICATE_MIN_NORMALIZED_LENGTH) continue;
    const list = duplicateGroups.get(normalized) ?? [];
    list.push(chunk.id);
    duplicateGroups.set(normalized, list);
  }
  let duplicateChunkCount = 0;
  for (const ids of duplicateGroups.values()) {
    if (ids.length > 1) {
      duplicateChunkCount += ids.length - 1;
      issues.push({
        severity: "WARNING",
        code: "CHUNK_DUPLICATE_CONTENT",
        message: "동일 또는 유사한 내용의 chunk가 중복되어 있습니다.",
        field: ids[0],
        hint: `${ids.length}개 chunk가 동일 본문을 공유합니다.`,
      });
    }
  }

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
