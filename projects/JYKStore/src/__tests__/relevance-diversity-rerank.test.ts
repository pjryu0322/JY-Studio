import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { KnowledgeChunk, SourceDocument } from "@prisma/client";
import {
  computeFinalRelevanceScore,
  deduplicateScoredCandidates,
  normalizeForDedupe,
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

describe("relevance-diversity-rerank", () => {
  it("normalizes title suffix and punctuation for dedupe", () => {
    assert.equal(
      normalizeForDedupe("기획단계 대가 산정 (1)"),
      normalizeForDedupe("기획단계 대가 산정"),
    );
  });

  it("dedupes identical chunkId, parent/split family, and near-duplicate bodies", () => {
    const a = scored(
      makeChunk({
        id: "a",
        title: "A",
        content: "동일본문 내용입니다. ".repeat(20),
        section: "S1",
      }),
      { vectorSimilarity: 0.9, metadata: { splitSourceId: "family-1", pageStart: 10 } },
    );
    const b = scored(
      makeChunk({
        id: "b",
        title: "A twin",
        content: "동일본문 내용입니다. ".repeat(20),
        section: "S1",
      }),
      { vectorSimilarity: 0.85, metadata: { splitSourceId: "family-1", pageStart: 10 } },
    );
    const c = scored(
      makeChunk({
        id: "c",
        title: "Near",
        content: "동일본문 내용입니다. ".repeat(19) + "거의같음 ",
        section: "S1",
      }),
      { vectorSimilarity: 0.84, metadata: { splitSourceId: "family-2", pageStart: 11 } },
    );
    const d = scored(
      makeChunk({
        id: "d",
        title: "Other section",
        content: "완전히 다른 섹션의 본문입니다. 감리 절차를 설명합니다. ".repeat(8),
        section: "S2",
      }),
      { vectorSimilarity: 0.7, metadata: { splitSourceId: "family-3", pageStart: 20 } },
    );
    const e = scored(
      makeChunk({
        id: "e",
        title: "Other page",
        content: "페이지가 다른 별도 설명입니다. 보고서 작성 주의사항. ".repeat(8),
        section: "S3",
      }),
      { vectorSimilarity: 0.68, metadata: { splitSourceId: "family-4", pageStart: 30 } },
    );

    const { kept, removedCount } = deduplicateScoredCandidates([a, b, c, d, e]);
    assert.ok(removedCount >= 1);
    assert.ok(kept.some((x) => x.chunk.id === "a" || x.chunk.id === "b"));
    assert.ok(kept.some((x) => x.chunk.id === "d"));
    assert.ok(kept.some((x) => x.chunk.id === "e"));
    assert.equal(new Set(kept.map((x) => x.chunk.id)).size, kept.length);
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

  it("limits same parent family and returns fewer than topK when candidates are weak", () => {
    const query = "감리 결과보고서";
    const family = Array.from({ length: 3 }, (_, i) =>
      scored(
        makeChunk({
          id: `f-${i}`,
          title: `결과보고서 조각 ${i}`,
          content: `감리 결과보고서 작성 시 주의사항 조각 ${i}. `.repeat(10),
          section: "결과보고서",
        }),
        {
          vectorSimilarity: 0.9 - i * 0.01,
          metadata: { splitSourceId: "same-parent", pageStart: 40 + i },
        },
      ),
    );
    const other = scored(
      makeChunk({
        id: "other-sec",
        title: "다른 섹션",
        content: "감리 결과보고서와 관련된 별도 섹션 내용입니다. ".repeat(8),
        section: "부록",
      }),
      { vectorSimilarity: 0.75, metadata: { splitSourceId: "other", pageStart: 90 } },
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
    assert.equal(familyKept.length, 1);
    assert.ok(selected.some((s) => s.chunk.id === "other-sec"));
    assert.equal(stats.rerankMode, "relevance_diversity_v1");
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
