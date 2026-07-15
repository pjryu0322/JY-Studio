import {
  DOCLING_RETRIEVAL_CHUNK_TYPE,
} from "@/lib/docling-knowledge/docling-knowledge-stages";
import { prisma } from "@/lib/prisma";
import { runRetrievalForEvaluation } from "@/lib/retrieval-service";

export const DOCLING_RETRIEVAL_PASS_THRESHOLDS = {
  recallAt5: 0.8,
  hitAt3: 0.75,
  sourceDocumentMatchRate: 1,
  provenanceCompletenessRate: 1,
  crossVersionContamination: 0,
  crossDocumentContamination: 0,
  searchErrors: 0,
} as const;

/** Allow WARNING to open distribution? Default false — PASS only. */
export const DOCLING_RETRIEVAL_WARNING_OPENS_DISTRIBUTION = false;

export type DoclingEvalCase = {
  query: string;
  questionType: string;
  expectedChunkIds: string[];
  expectedKnowledgeUnitId: string | null;
  expectedSourceDocumentId: string | null;
  expectedPageStart: number | null;
  expectedPageEnd: number | null;
  expectedKeywords: string[];
};

export type DoclingRetrievalEvalResult = {
  status: "PASS" | "WARNING" | "FAIL";
  smoke: {
    ok: boolean;
    embeddingPresent: boolean;
    resultReturned: boolean;
    errors: number;
  };
  questionCount: number;
  passedCount: number;
  failedCount: number;
  recallAt5: number;
  hitAt3: number;
  mrr: number;
  expectedChunkHitRate: number;
  expectedUnitHitRate: number;
  sourceDocumentMatchRate: number;
  pageMatchRate: number;
  provenanceCompletenessRate: number;
  searchErrorCount: number;
  crossVersionContamination: number;
  crossDocumentContamination: number;
  failures: Array<{
    query: string;
    expectedChunkIds: string[];
    topChunkIds: string[];
    reason: string;
  }>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function questionTypeFromTags(tags: string[]): string {
  const joined = tags.join(" ");
  if (joined.includes("표")) return "표";
  if (joined.includes("그림")) return "그림";
  if (joined.includes("절차")) return "절차";
  if (joined.includes("기능")) return "기능";
  if (joined.includes("개념")) return "개념";
  return "개념";
}

/** Rule-based eval questions from draft generation chunks (no LLM). */
export function buildDoclingRetrievalEvalCases(
  chunks: Array<{
    id: string;
    title: string;
    content: string;
    section: string | null;
    tags: string[];
    sourceDocumentId: string | null;
    metadata: unknown;
  }>,
): DoclingEvalCase[] {
  const cases: DoclingEvalCase[] = [];
  const seen = new Set<string>();

  const push = (draft: DoclingEvalCase) => {
    const key = draft.query.toLowerCase().replace(/\s+/g, " ").trim();
    if (!key || seen.has(key) || draft.expectedChunkIds.length === 0) return;
    seen.add(key);
    cases.push(draft);
  };

  const target =
    chunks.length < 12 ? 10 : chunks.length < 40 ? 20 : Math.min(40, chunks.length);

  for (const chunk of chunks) {
    if (cases.length >= target) break;
    const meta = asRecord(chunk.metadata) ?? {};
    const unitId =
      typeof meta.knowledgeUnitId === "string" ? meta.knowledgeUnitId : null;
    const pageStart =
      typeof meta.pageStart === "number"
        ? meta.pageStart
        : typeof meta.page === "number"
          ? meta.page
          : null;
    const pageEnd =
      typeof meta.pageEnd === "number" ? meta.pageEnd : pageStart;
    const keywords = chunk.title
      .split(/[\s/>|:：·\-]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2)
      .slice(0, 4);

    // Prefer content-derived query, not exact title echo-only smoke.
    const firstSentence =
      chunk.content
        .replace(/^경로:.*$/m, "")
        .replace(/^표 캡션:.*$/m, "")
        .replace(/^그림 설명:\s*/m, "")
        .split(/[.。\n]/)
        .map((s) => s.trim())
        .find((s) => s.length >= 8) ?? chunk.title;

    const queryBase = firstSentence.slice(0, 80).trim();
    if (queryBase.length >= 4) {
      push({
        query: queryBase,
        questionType: questionTypeFromTags(chunk.tags),
        expectedChunkIds: [chunk.id],
        expectedKnowledgeUnitId: unitId,
        expectedSourceDocumentId: chunk.sourceDocumentId,
        expectedPageStart: pageStart,
        expectedPageEnd: pageEnd,
        expectedKeywords: keywords,
      });
    }

    if (chunk.section && cases.length < target) {
      const sectionQuery = `${chunk.title} ${chunk.section}`.trim().slice(0, 100);
      push({
        query: sectionQuery,
        questionType: questionTypeFromTags(chunk.tags),
        expectedChunkIds: [chunk.id],
        expectedKnowledgeUnitId: unitId,
        expectedSourceDocumentId: chunk.sourceDocumentId,
        expectedPageStart: pageStart,
        expectedPageEnd: pageEnd,
        expectedKeywords: keywords,
      });
    }
  }

  // Ensure table/figure coverage when present
  const tables = chunks.filter((c) => c.tags.some((t) => t.includes("표")));
  const figures = chunks.filter((c) => c.tags.some((t) => t.includes("그림")));
  for (const group of [tables, figures]) {
    const c = group[0];
    if (!c) continue;
    const meta = asRecord(c.metadata) ?? {};
    push({
      query: c.title.slice(0, 80),
      questionType: questionTypeFromTags(c.tags),
      expectedChunkIds: [c.id],
      expectedKnowledgeUnitId:
        typeof meta.knowledgeUnitId === "string" ? meta.knowledgeUnitId : null,
      expectedSourceDocumentId: c.sourceDocumentId,
      expectedPageStart: typeof meta.page === "number" ? meta.page : null,
      expectedPageEnd: typeof meta.page === "number" ? meta.page : null,
      expectedKeywords: c.title.split(/\s+/).slice(0, 3),
    });
  }

  return cases.slice(0, Math.max(target, cases.length));
}

export async function runDoclingRetrievalEvaluation(input: {
  packId: string;
  versionId: string;
  indexGenerationId: string;
}): Promise<DoclingRetrievalEvalResult> {
  const chunks = await prisma.knowledgeChunk.findMany({
    where: {
      versionId: input.versionId,
      isActive: true,
      chunkType: DOCLING_RETRIEVAL_CHUNK_TYPE,
    },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      title: true,
      content: true,
      section: true,
      tags: true,
      sourceDocumentId: true,
      metadata: true,
    },
  });

  const draftChunks = chunks.filter((c) => {
    const meta = asRecord(c.metadata);
    return meta?.indexGenerationId === input.indexGenerationId;
  });

  const evalChunks = draftChunks.length > 0 ? draftChunks : chunks;

  const embeddingCount = await prisma.knowledgeChunkEmbedding.count({
    where: { chunkId: { in: evalChunks.map((c) => c.id) } },
  });

  let smokeErrors = 0;
  let smokeReturned = false;
  if (evalChunks[0]) {
    try {
      const smoke = await runRetrievalForEvaluation({
        knowledgePackId: input.packId,
        versionId: input.versionId,
        query: evalChunks[0].title || "test",
        retrievalMode: "hybrid",
        topK: 3,
        indexGenerationId: input.indexGenerationId,
      });
      smokeReturned = smoke.length > 0;
    } catch {
      smokeErrors += 1;
    }
  }

  const cases = buildDoclingRetrievalEvalCases(evalChunks);
  const failures: DoclingRetrievalEvalResult["failures"] = [];
  let recallHits = 0;
  let hit3 = 0;
  let mrrSum = 0;
  let chunkHits = 0;
  let unitHits = 0;
  let sourceMatches = 0;
  let pageMatches = 0;
  let provenanceOk = 0;
  let searchErrors = smokeErrors;
  let crossVersion = 0;
  let crossDocument = 0;
  let sourceChecked = 0;
  let pageChecked = 0;
  let unitChecked = 0;

  for (const c of cases) {
    let ranked: Awaited<ReturnType<typeof runRetrievalForEvaluation>> = [];
    try {
      ranked = await runRetrievalForEvaluation({
        knowledgePackId: input.packId,
        versionId: input.versionId,
        query: c.query,
        retrievalMode: "hybrid",
        topK: 5,
        indexGenerationId: input.indexGenerationId,
      });
    } catch {
      searchErrors += 1;
      failures.push({
        query: c.query,
        expectedChunkIds: c.expectedChunkIds,
        topChunkIds: [],
        reason: "search_error",
      });
      continue;
    }

    const ids = ranked.map((r) => r.chunkId);
    const hitAt5 = c.expectedChunkIds.some((id) => ids.includes(id));
    const hitAt3Case = c.expectedChunkIds.some((id) => ids.slice(0, 3).includes(id));
    if (hitAt5) {
      recallHits += 1;
      chunkHits += 1;
    } else {
      failures.push({
        query: c.query,
        expectedChunkIds: c.expectedChunkIds,
        topChunkIds: ids.slice(0, 5),
        reason: "expected_chunk_miss",
      });
    }
    if (hitAt3Case) hit3 += 1;

    let rr = 0;
    for (let i = 0; i < ids.length; i += 1) {
      if (c.expectedChunkIds.includes(ids[i]!)) {
        rr = 1 / (i + 1);
        break;
      }
    }
    mrrSum += rr;

    if (c.expectedKnowledgeUnitId) {
      unitChecked += 1;
      const unitHit = ranked.some((r) => {
        const meta = asRecord(r.metadata);
        return meta?.knowledgeUnitId === c.expectedKnowledgeUnitId;
      });
      if (unitHit) unitHits += 1;
    }

    if (c.expectedSourceDocumentId) {
      sourceChecked += 1;
      const match = ranked.some(
        (r) => r.sourceDocumentId === c.expectedSourceDocumentId,
      );
      if (match) sourceMatches += 1;
      for (const r of ranked) {
        if (r.sourceDocumentId && r.sourceDocumentId !== c.expectedSourceDocumentId) {
          // same version/doc pack is fine; track only foreign pack refs if present
          const meta = asRecord(r.metadata);
          if (
            meta?.normalizedDocumentId &&
            meta.normalizedDocumentId !==
              asRecord(evalChunks.find((x) => x.id === r.chunkId)?.metadata)
                ?.normalizedDocumentId
          ) {
            crossDocument += 1;
          }
        }
      }
    }

    if (c.expectedPageStart != null) {
      pageChecked += 1;
      const pageHit = ranked.some((r) => {
        const meta = asRecord(r.metadata);
        const p =
          typeof meta?.pageStart === "number"
            ? meta.pageStart
            : typeof meta?.page === "number"
              ? meta.page
              : null;
        return p === c.expectedPageStart;
      });
      if (pageHit) pageMatches += 1;
    }

    const expected = evalChunks.find((x) => x.id === c.expectedChunkIds[0]);
    const meta = asRecord(expected?.metadata);
    const hasProv =
      Boolean(expected?.sourceDocumentId) &&
      Boolean(meta?.normalizedDocumentId) &&
      Boolean(meta?.fingerprint || meta?.normalizedDocumentFingerprint) &&
      Boolean(meta?.pipelineRunId) &&
      Boolean(meta?.indexGenerationId);
    if (hasProv) provenanceOk += 1;

    for (const r of ranked) {
      const metaR = asRecord(r.metadata);
      if (
        typeof metaR?.versionId === "string" &&
        metaR.versionId !== input.versionId
      ) {
        crossVersion += 1;
      }
    }
  }

  const n = cases.length;
  const recallAt5 = n > 0 ? recallHits / n : 0;
  const hitAt3Rate = n > 0 ? hit3 / n : 0;
  const mrr = n > 0 ? mrrSum / n : 0;
  const expectedChunkHitRate = n > 0 ? chunkHits / n : 0;
  const expectedUnitHitRate = unitChecked > 0 ? unitHits / unitChecked : 1;
  const sourceDocumentMatchRate =
    sourceChecked > 0 ? sourceMatches / sourceChecked : 1;
  const pageMatchRate = pageChecked > 0 ? pageMatches / pageChecked : 1;
  const provenanceCompletenessRate = n > 0 ? provenanceOk / n : 0;

  const smoke = {
    ok: smokeErrors === 0 && smokeReturned && embeddingCount > 0,
    embeddingPresent: embeddingCount > 0,
    resultReturned: smokeReturned,
    errors: smokeErrors,
  };

  let status: "PASS" | "WARNING" | "FAIL" = "PASS";
  const t = DOCLING_RETRIEVAL_PASS_THRESHOLDS;
  const hardFail =
    n === 0 ||
    recallAt5 < 0.5 ||
    searchErrors > t.searchErrors ||
    crossVersion > t.crossVersionContamination ||
    crossDocument > t.crossDocumentContamination ||
    provenanceCompletenessRate < 0.5 ||
    !smoke.ok;

  const softFail =
    recallAt5 < t.recallAt5 ||
    hitAt3Rate < t.hitAt3 ||
    sourceDocumentMatchRate < t.sourceDocumentMatchRate ||
    provenanceCompletenessRate < t.provenanceCompletenessRate;

  if (hardFail) status = "FAIL";
  else if (softFail) status = "WARNING";
  else status = "PASS";

  // Never promote to PASS solely because failures array is empty when metrics miss thresholds.
  if (status === "PASS" && softFail) status = "WARNING";

  return {
    status,
    smoke,
    questionCount: n,
    passedCount: recallHits,
    failedCount: failures.length,
    recallAt5,
    hitAt3: hitAt3Rate,
    mrr,
    expectedChunkHitRate,
    expectedUnitHitRate,
    sourceDocumentMatchRate,
    pageMatchRate,
    provenanceCompletenessRate,
    searchErrorCount: searchErrors,
    crossVersionContamination: crossVersion,
    crossDocumentContamination: crossDocument,
    failures: failures.slice(0, 8),
  };
}
