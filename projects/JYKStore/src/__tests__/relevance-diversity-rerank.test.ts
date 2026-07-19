import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { KnowledgeChunk, SourceDocument } from "@prisma/client";
import {
  RELEVANCE_TIE_EPSILON,
  RETRIEVAL_RANKING_POLICY_VERSION,
  TOP3_MAX_SAME_FAMILY,
  TOP5_MAX_SAME_FAMILY,
  computeFinalRelevanceScore,
  deduplicateScoredCandidates,
  normalizeBodyForDedupe,
  normalizeForDedupe,
  normalizeTitleForDedupe,
  normalizedDiversityScore,
  selectDiverseTopK,
} from "../lib/retrieval/relevance-diversity-rerank.ts";
import type { ScoredCandidate } from "../lib/retrieval/retrieval-types.ts";

function makeChunk(
  overrides: Partial<KnowledgeChunk> & { id: string; title: string; content: string },
): KnowledgeChunk & { sourceDocument: SourceDocument | null } {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: overrides.id,
    versionId: "ver-1",
    sourceDocumentId: overrides.sourceDocumentId ?? "doc-1",
    chunkType: "SECTION",
    title: overrides.title,
    content: overrides.content,
    section: overrides.section ?? null,
    tags: [],
    metadata: overrides.metadata ?? null,
    chunkGenerationId: "cg-1",
    sortOrder: overrides.sortOrder ?? 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    sourceDocument: null,
  };
}

function scored(
  chunk: ReturnType<typeof makeChunk>,
  opts: {
    score?: number;
    vectorSimilarity?: number;
    metadata?: Record<string, unknown> | null;
  } = {},
): ScoredCandidate {
  return {
    chunk: {
      ...chunk,
      metadata: opts.metadata ?? chunk.metadata,
    },
    metadataRecord: (opts.metadata ??
      (chunk.metadata as Record<string, unknown> | null) ??
      null) as Record<string, unknown> | null,
    keywordScore: 1,
    metadataScore: 0,
    vectorScore: (opts.vectorSimilarity ?? 0.5) * 100,
    vectorSimilarity: opts.vectorSimilarity ?? 0.5,
    score: opts.score ?? 50,
    matchReasons: [],
  };
}

/** Build candidates with controlled finalRelevance via vectorSimilarity + title. */
function withSim(
  id: string,
  title: string,
  content: string,
  section: string,
  sim: number,
  metadata?: Record<string, unknown>,
): ScoredCandidate {
  return scored(
    makeChunk({ id, title, content, section, metadata: metadata ?? null }),
    { vectorSimilarity: sim, metadata: metadata ?? null },
  );
}

describe("relevance-diversity-rerank", () => {
  it("normalizes title suffix only; body keeps numbered parentheses", () => {
    assert.equal(
      normalizeTitleForDedupe("기획단계 대가 산정 (1)"),
      normalizeTitleForDedupe("기획단계 대가 산정"),
    );
    assert.notEqual(
      normalizeBodyForDedupe("점검 항목 (1)"),
      normalizeBodyForDedupe("점검 항목 (2)"),
    );
    assert.match(normalizeBodyForDedupe("(1) 사업관리 점검"), /\(1\)/);
    assert.match(normalizeBodyForDedupe("제1조 목적"), /제1조/);
    assert.equal(normalizeForDedupe("a"), normalizeBodyForDedupe("a"));
  });

  it("keeps numbered audit checklist items as distinct bodies", () => {
    const items = [
      "(1) 사업관리 점검",
      "(2) 품질관리 점검",
      "(3) 보안관리 점검",
      "1. 적용 대상",
      "2. 계산 방법",
      "표 1 요약",
      "표 2 상세",
    ].map((content, i) =>
      withSim(`n-${i}`, content, `${content} `.repeat(12), "점검", 0.8, {
        splitSourceId: "ku-check",
        pageStart: 10 + i,
      }),
    );
    const { kept, removedCount } = deduplicateScoredCandidates(items);
    assert.equal(removedCount, 0);
    assert.equal(kept.length, items.length);
  });

  it("does not reward missing metadata as diversity", () => {
    const withMeta = withSim(
      "full",
      "기획단계 대가 산정",
      "기획단계 대가 산정 상세 설명입니다. ".repeat(5),
      "기획",
      0.86,
      { splitSourceId: "f1", pageStart: 3 },
    );
    const noMeta = scored(
      makeChunk({
        id: "bare",
        title: "기획단계 대가 산정",
        content: "기획단계 대가 산정 다른 설명입니다. ".repeat(5),
        section: null,
        sourceDocumentId: null,
      }),
      { vectorSimilarity: 0.86, metadata: null },
    );
    const rankedFull = {
      item: withMeta,
      relevance: 0.8,
      meta: {
        splitSourceId: "f1",
        parentChunkId: null,
        pageStart: 3,
        pageEnd: 3,
        primaryContentLength: 100,
        hasTableHeader: false,
      },
    };
    const rankedBare = {
      item: noMeta,
      relevance: 0.8,
      meta: {
        splitSourceId: null,
        parentChunkId: null,
        pageStart: null,
        pageEnd: null,
        primaryContentLength: 100,
        hasTableHeader: false,
      },
    };
    const seed = {
      item: withSim(
        "seed",
        "seed",
        "seed body ".repeat(20),
        "기획",
        0.9,
        { splitSourceId: "f0", pageStart: 1 },
      ),
      relevance: 0.9,
      meta: {
        splitSourceId: "f0",
        parentChunkId: null,
        pageStart: 1,
        pageEnd: 1,
        primaryContentLength: 100,
        hasTableHeader: false,
      },
    };
    const divFull = normalizedDiversityScore(rankedFull, seed);
    const divBare = normalizedDiversityScore(rankedBare, seed);
    assert.ok(divFull > divBare, `full ${divFull} vs bare ${divBare}`);
  });

  it("does not max body diversity for short texts", () => {
    const a = {
      item: withSim("a", "적용 대상", "적용 대상", "S", 0.5, {
        splitSourceId: "f1",
        pageStart: 1,
      }),
      relevance: 0.5,
      meta: {
        splitSourceId: "f1",
        parentChunkId: null,
        pageStart: 1,
        pageEnd: 1,
        primaryContentLength: 4,
        hasTableHeader: false,
      },
    };
    const b = {
      item: withSim("b", "적용 기준", "적용 기준", "T", 0.5, {
        splitSourceId: "f2",
        pageStart: 2,
      }),
      relevance: 0.5,
      meta: {
        splitSourceId: "f2",
        parentChunkId: null,
        pageStart: 2,
        pageEnd: 2,
        primaryContentLength: 4,
        hasTableHeader: false,
      },
    };
    // body contribution alone must be 0 for short texts (score may still have section/page).
    const score = normalizedDiversityScore(a, b);
    assert.ok(score <= 0.85); // without body 0.15 max from other signals only
  });

  it("exports ranking policy v2", () => {
    assert.equal(RETRIEVAL_RANKING_POLICY_VERSION, "relevance_diversity_v2");
  });

  it("normalizes title suffix and punctuation for dedupe", () => {
    assert.equal(
      normalizeForDedupe("기획단계 대가 산정"),
      normalizeBodyForDedupe("기획단계 대가 산정"),
    );
  });

  it("preserves distinct same-family chunks and only removes true duplicates", () => {
    const a = withSim(
      "a",
      "적용 대상",
      "대가산정 적용 대상에 대한 상세 설명입니다. ".repeat(6),
      "S1",
      0.9,
      { splitSourceId: "ku-1", knowledgeUnitId: "ku-1", pageStart: 10 },
    );
    const b = withSim(
      "b",
      "계산 방식",
      "대가산정 계산 방식과 산정식을 설명합니다. ".repeat(6),
      "S1",
      0.88,
      { splitSourceId: "ku-1", knowledgeUnitId: "ku-1", pageStart: 11 },
    );
    const c = withSim(
      "c",
      "예외와 주의사항",
      "대가산정 예외와 주의사항을 별도로 안내합니다. ".repeat(6),
      "S1",
      0.86,
      { splitSourceId: "ku-1", knowledgeUnitId: "ku-1", pageStart: 12 },
    );
    const { kept, removedCount } = deduplicateScoredCandidates([a, b, c]);
    assert.equal(removedCount, 0);
    assert.equal(kept.length, 3);
  });

  it("dedupes same-family chunks when normalized bodies match", () => {
    const body = "동일 본문 내용입니다. 공백과 구두점만 다를 수 있습니다. ".repeat(8);
    const a = withSim("a", "A", body, "S1", 0.9, {
      splitSourceId: "family-1",
      pageStart: 10,
    });
    const b = withSim("b", "B", `${body}!!!`, "S1", 0.85, {
      splitSourceId: "family-1",
      pageStart: 10,
    });
    const { kept, removedCount } = deduplicateScoredCandidates([a, b]);
    assert.equal(removedCount, 1);
    assert.equal(kept.length, 1);
    assert.equal(kept[0]?.chunk.id, "a");
  });

  it("dedupes near-duplicate bodies even across different families", () => {
    const words = Array.from({ length: 100 }, (_, i) => `점검단어${i}`);
    const aBody = words.join(" ");
    const bWords = [...words];
    bWords[50] = "점검단어50x";
    const bBody = bWords.join(" ");
    const a = withSim("a", "A", aBody, "S1", 0.9, {
      splitSourceId: "family-a",
      pageStart: 1,
    });
    const b = withSim("b", "B", bBody, "S2", 0.88, {
      splitSourceId: "family-b",
      pageStart: 2,
    });
    const { kept, removedCount } = deduplicateScoredCandidates([a, b]);
    assert.equal(removedCount, 1);
    assert.equal(kept.length, 1);
  });

  it("keeps short distinct bodies even in the same family", () => {
    const a = withSim("a", "적용 대상", "적용 대상", "S1", 0.8, {
      splitSourceId: "ku-short",
      pageStart: 1,
    });
    const b = withSim("b", "적용 기준", "적용 기준", "S1", 0.79, {
      splitSourceId: "ku-short",
      pageStart: 1,
    });
    const { kept, removedCount } = deduplicateScoredCandidates([a, b]);
    assert.equal(removedCount, 0);
    assert.equal(kept.length, 2);
  });

  it("keeps different content on same source/page/section", () => {
    const a = withSim(
      "a",
      "산정 대상",
      "산정 대상에 포함되는 사업 유형을 설명합니다. ".repeat(5),
      "대가산정",
      0.85,
      { splitSourceId: "ku-x", pageStart: 20 },
    );
    const b = withSim(
      "b",
      "계산식",
      "대가산정 계산식과 계수를 설명합니다. ".repeat(5),
      "대가산정",
      0.84,
      { splitSourceId: "ku-x", pageStart: 20 },
    );
    const { kept } = deduplicateScoredCandidates([a, b]);
    assert.equal(kept.length, 2);
  });

  it("does not let diversity invert ranks 2–3 when relevance gap exceeds epsilon", () => {
    const query = "기획단계 대가 산정";
    // Rank1 seed
    const rank1 = withSim(
      "r1",
      "기획단계 대가 산정",
      "기획단계 대가 산정 방법을 직접 설명합니다. ".repeat(4),
      "기획",
      0.95,
      { splitSourceId: "f1", pageStart: 1 },
    );
    // Higher relevance, same section/page as rank1 → low diversity
    const a = withSim(
      "a",
      "기획단계 대가 산정 세부",
      "기획단계 대가 산정 세부 절차와 적용 기준입니다. ".repeat(4),
      "기획",
      0.88,
      { splitSourceId: "f1", pageStart: 1 },
    );
    // Lower relevance, different section → high diversity
    const b = withSim(
      "b",
      "일반 개요",
      "문서 개요와 배경 설명을 제공합니다. ".repeat(4),
      "개요",
      0.77,
      { splitSourceId: "f2", pageStart: 99 },
    );

    const scoreA = computeFinalRelevanceScore(a, query);
    const scoreB = computeFinalRelevanceScore(b, query);
    assert.ok(scoreA - scoreB > RELEVANCE_TIE_EPSILON, `${scoreA} vs ${scoreB}`);

    const { selected } = selectDiverseTopK({
      scored: [rank1, a, b],
      query,
      topK: 3,
    });
    assert.equal(selected[0]?.chunk.id, "r1");
    assert.equal(selected[1]?.chunk.id, "a");
    assert.equal(selected[2]?.chunk.id, "b");
  });

  it("may use diversity inside relevance tie epsilon", () => {
    const query = "기획단계 대가 산정";
    const sharedTitle = "기획단계 대가 산정 안내";
    const rank1 = withSim(
      "r1",
      sharedTitle,
      "기획단계 대가 산정 핵심 설명을 제공합니다. ".repeat(4),
      "핵심",
      0.95,
      { splitSourceId: "f0", pageStart: 1 },
    );
    // Same section/page as rank1 → lower diversity; nearly tied relevance.
    const same = withSim(
      "same",
      sharedTitle,
      "기획단계 대가 산정 안내 A형 보충 설명입니다. ".repeat(4),
      "핵심",
      0.86,
      { splitSourceId: "f1", pageStart: 1 },
    );
    const other = withSim(
      "other",
      sharedTitle,
      "기획단계 대가 산정 안내 B형 참고 설명입니다. ".repeat(4),
      "부록",
      0.858,
      { splitSourceId: "f2", pageStart: 50 },
    );

    const scoreSame = computeFinalRelevanceScore(same, query);
    const scoreOther = computeFinalRelevanceScore(other, query);
    assert.ok(
      Math.abs(scoreSame - scoreOther) <= RELEVANCE_TIE_EPSILON,
      `${scoreSame} vs ${scoreOther}`,
    );

    const { selected } = selectDiverseTopK({
      scored: [rank1, same, other],
      query,
      topK: 3,
    });
    assert.equal(selected[0]?.chunk.id, "r1");
    // Diversity should prefer other section/page within the tie group.
    assert.equal(selected[1]?.chunk.id, "other");
  });

  it("ranks keyword-direct match above generic overview when vector scores are close", () => {
    const query = "기획단계 대가 산정";
    const generic = scored(
      makeChunk({
        id: "generic",
        title: "대가 산정 모형의 일반적 절차",
        content: "대가 산정의 일반적인 절차를 설명합니다.",
        section: "개요",
      }),
      { vectorSimilarity: 0.82 },
    );
    const direct = scored(
      makeChunk({
        id: "direct",
        title: "기획단계 IT컨설팅사업 대가산정",
        content: "기획단계의 IT컨설팅사업 대가산정 방법을 안내합니다.",
        section: "기획단계 대가산정",
      }),
      { vectorSimilarity: 0.8 },
    );

    const scoreGeneric = computeFinalRelevanceScore(generic, query);
    const scoreDirect = computeFinalRelevanceScore(direct, query);
    assert.ok(
      scoreDirect > scoreGeneric,
      `expected direct ${scoreDirect} > generic ${scoreGeneric}`,
    );

    const { selected } = selectDiverseTopK({
      scored: [generic, direct],
      query,
      topK: 2,
    });
    assert.equal(selected[0]?.chunk.id, "direct");
  });

  it("keeps rank-1 as highest relevance and does not diversify it away", () => {
    const query = "감리 점검 절차";
    const best = scored(
      makeChunk({
        id: "best",
        title: "감리 점검 절차",
        content: "감리 점검 절차를 단계별로 설명합니다.",
        section: "점검절차",
      }),
      { vectorSimilarity: 0.95 },
    );
    const otherSection = scored(
      makeChunk({
        id: "other",
        title: "개요",
        content: "문서 개요입니다.",
        section: "개요",
      }),
      { vectorSimilarity: 0.5 },
    );
    const { selected } = selectDiverseTopK({
      scored: [otherSection, best],
      query,
      topK: 5,
    });
    assert.equal(selected[0]?.chunk.id, "best");
  });

  it("allows up to TOP3_MAX_SAME_FAMILY distinct family chunks in top results", () => {
    assert.equal(TOP3_MAX_SAME_FAMILY, 2);
    assert.equal(TOP5_MAX_SAME_FAMILY, 2);

    const query = "감리 결과보고서";
    const family = Array.from({ length: 3 }, (_, i) =>
      withSim(
        `f-${i}`,
        `결과보고서 조각 ${i}`,
        `감리 결과보고서 작성 시 주의사항 조각 ${i} 상세 내용입니다. `.repeat(6),
        "결과보고서",
        0.9 - i * 0.02,
        { splitSourceId: "same-parent", pageStart: 40 + i },
      ),
    );
    const other = withSim(
      "other-sec",
      "다른 섹션",
      "감리 결과보고서와 관련된 별도 섹션 내용입니다. ".repeat(6),
      "부록",
      0.75,
      { splitSourceId: "other", pageStart: 90 },
    );

    const { selected, stats } = selectDiverseTopK({
      scored: [...family, other],
      query,
      topK: 5,
    });
    assert.ok(selected.length <= 5);
    assert.ok(selected.length >= 2);
    const familyKept = selected.filter(
      (s) => (s.metadataRecord?.splitSourceId as string | undefined) === "same-parent",
    );
    assert.ok(familyKept.length <= TOP5_MAX_SAME_FAMILY);
    assert.ok(familyKept.length >= 1);
    assert.ok(selected.some((s) => s.chunk.id === "other-sec"));
    assert.equal(stats.rerankMode, RETRIEVAL_RANKING_POLICY_VERSION);
  });

  it("does not pad topK with low-relevance candidates", () => {
    const query = "SW사업 대가산정 기준";
    const strong = scored(
      makeChunk({
        id: "strong",
        title: "SW사업 대가산정 기준",
        content: "SW사업 대가산정 기준을 설명합니다.",
        section: "대가산정",
      }),
      { vectorSimilarity: 0.91 },
    );
    const weak = scored(
      makeChunk({
        id: "weak",
        title: "서문",
        content: "이 문서는 감리 해설서입니다.",
        section: "서문",
      }),
      { vectorSimilarity: 0.15, score: 1 },
    );
    const { selected } = selectDiverseTopK({
      scored: [strong, weak],
      query,
      topK: 5,
    });
    assert.equal(selected[0]?.chunk.id, "strong");
    assert.ok(!selected.some((s) => s.chunk.id === "weak") || selected.length === 1);
  });
});
