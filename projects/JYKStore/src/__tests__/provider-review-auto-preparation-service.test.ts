import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AUTO_PIPELINE_GENERATED_BY,
  AUTO_SOURCE_CHUNK_TYPE,
  buildRetrievalChunkContent,
  normalizeAndClamp,
  regenerateAutoChunksForPack,
} from "@/lib/auto-pipeline/provider-auto-chunk-service";
import { AUTO_KNOWLEDGE_UNIT_CHUNK_TYPE } from "@/lib/admin-knowledge-unit-draft-activation-dto";
import { AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE } from "@/lib/github-auto-collect/github-knowledge-unit-draft-generator";
import { buildProviderInspectionReadiness } from "@/lib/provider-pack-inspection-readiness";
import type { ProviderPackDetailDto } from "@/lib/provider-pack-dto";
import type { StructureQualitySummaryDto } from "@/lib/structure-quality/structure-quality-dto";
import type { ChunkQualitySummaryDto } from "@/lib/chunk-quality/chunk-quality-dto";
import type { RetrievalEvaluationSummaryDto } from "@/lib/retrieval-evaluation/retrieval-evaluation-dto";

const NOW = "2026-07-08T12:00:00.000Z";

function createAutoChunkMockPrisma() {
  const created: Array<Record<string, unknown>> = [];
  const drafts = [
    {
      id: "draft-1",
      versionId: "ver-1",
      sourceDocumentId: "doc-1",
      chunkType: AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE,
      title: "Grid Overview",
      content: "짧은 초안",
      section: "Overview",
      tags: ["grid"],
      isActive: false,
      metadata: {
        reviewStatus: "pending_review",
        sourcePath: "docs/guide.md",
        topic: "Overview",
        evidence: { excerpt: "TOAST UI Grid는 데이터 그리드 컴포넌트입니다." },
        semanticTopicKey: "overview",
        canonicalSourcePath: "docs/guide.md",
      },
    },
    {
      id: "draft-2",
      versionId: "ver-1",
      sourceDocumentId: "doc-1",
      chunkType: AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE,
      title: "Install",
      content: "설치 방법 요약",
      section: "Install",
      tags: ["install"],
      isActive: false,
      metadata: {
        reviewStatus: "pending_review",
        sourcePath: "docs/guide.md",
        topic: "Install",
        evidence: { excerpt: "npm install 으로 설치합니다." },
      },
    },
  ];

  const db = {
    knowledgePack: {
      findFirst: async () => ({
        packId: "pack-1",
        versions: [
          {
            id: "ver-1",
            sourceDocuments: [
              {
                id: "doc-1",
                title: "Guide",
                content: "x".repeat(200),
                validationStatus: "PASS",
                fileName: "docs/guide.md",
                sourceUrl: "https://github.com/nhn/tui.grid/blob/main/docs/guide.md",
              },
            ],
            chunks: drafts,
          },
        ],
      }),
    },
    knowledgeChunk: {
      aggregate: async () => ({ _max: { sortOrder: 2 } }),
      updateMany: async () => ({ count: 0 }),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return { id: `active-${created.length}`, ...data };
      },
    },
    $transaction: async (fn: (tx: typeof db) => Promise<void>) => fn(db),
  };

  return { db: db as never, created };
}

describe("provider review auto preparation helpers", () => {
  it("Case 1: regenerates active AUTO_KNOWLEDGE_UNIT chunks from drafts", async () => {
    const { db, created } = createAutoChunkMockPrisma();
    const result = await regenerateAutoChunksForPack(
      { packId: "pack-1", mode: "hybrid", replace: true },
      { prismaClient: db },
    );

    assert.equal("ok" in result && result.ok, true);
    if (!("ok" in result)) return;
    assert.ok(result.createdChunkCount >= 1);
    assert.equal(created.length, result.createdChunkCount);
    for (const chunk of created) {
      assert.equal(chunk.isActive, true);
      assert.ok(
        chunk.chunkType === AUTO_KNOWLEDGE_UNIT_CHUNK_TYPE ||
          chunk.chunkType === AUTO_SOURCE_CHUNK_TYPE,
      );
      assert.ok(String(chunk.content).length >= 120);
      assert.ok(chunk.section);
      assert.ok(Array.isArray(chunk.tags) && (chunk.tags as string[]).length > 0);
      assert.ok(chunk.sourceDocumentId);
      const meta = chunk.metadata as Record<string, unknown>;
      assert.equal(meta.generatedBy, AUTO_PIPELINE_GENERATED_BY);
    }
  });

  it("builds retrieval chunk content with minimum length and metadata parts", () => {
    const content = buildRetrievalChunkContent({
      title: "Grid",
      draftContent: "짧은 요약",
      sourceExcerpt: "원문 일부",
      sourcePath: "docs/guide.md",
    });
    assert.ok(content.length >= 120);
    assert.ok(content.includes("제목: Grid"));
    assert.ok(content.includes("원문 근거"));
    assert.ok(content.includes("출처: docs/guide.md"));
  });

  it("clamps oversized content", () => {
    const content = normalizeAndClamp("x".repeat(5000), 120, 4000);
    assert.ok(content.length <= 4000);
  });
});

function passingStructureQualitySummary(): StructureQualitySummaryDto {
  return {
    structureTemplateKey: "GENERIC_PRODUCT",
    structureTemplateName: "Generic",
    structureCoverage: {
      id: "sc",
      packId: "p",
      versionId: "v",
      templateKey: "GENERIC_PRODUCT",
      templateName: "Generic",
      status: "PASS",
      coverageScore: 100,
      requiredSectionCount: 1,
      coveredRequiredCount: 1,
      missingRequiredCount: 0,
      optionalSectionCount: 0,
      coveredOptionalCount: 0,
      summary: "ok",
      checkedAt: NOW,
      items: [],
    },
    knowledgeQuality: {
      id: "kq",
      packId: "p",
      versionId: "v",
      status: "PASS",
      totalScore: 90,
      completenessScore: 90,
      consistencyScore: 90,
      sourceQualityScore: 90,
      securityScore: 90,
      freshnessScore: 90,
      usabilityScore: 90,
      blockingIssueCount: 0,
      warningIssueCount: 0,
      summary: "ok",
      checkedAt: NOW,
      issues: [],
    },
    freshness: {
      status: "CURRENT",
      reason: null,
      reasonCode: null,
      latestVersionId: "v",
      coverageReportVersionId: "v",
      qualityReportVersionId: "v",
      coverageCheckedAt: NOW,
      qualityCheckedAt: NOW,
      latestSourceDocumentUpdatedAt: null,
      latestSourceValidationCheckedAt: null,
    },
  };
}

function passingChunkQualitySummary(): ChunkQualitySummaryDto {
  return {
    report: {
      id: "r1",
      packId: "p",
      versionId: "v",
      status: "PASS",
      totalScore: 90,
      coverageScore: 90,
      traceabilityScore: 90,
      sizeScore: 90,
      duplicateScore: 90,
      metadataScore: 90,
      structureAlignmentScore: 90,
      activeChunkCount: 1,
      inactiveChunkCount: 0,
      sourceDocumentCount: 1,
      coveredSourceDocumentCount: 1,
      orphanChunkCount: 0,
      missingSourceChunkCount: 0,
      shortChunkCount: 0,
      longChunkCount: 0,
      duplicateChunkCount: 0,
      chunkWithoutMetadataCount: 0,
      blockingIssueCount: 0,
      warningIssueCount: 0,
      summary: "",
      checkedAt: NOW,
      issues: [],
      metrics: [],
    },
    freshness: {
      status: "CURRENT",
      reason: null,
      reasonCode: null,
      latestVersionId: "v",
      reportVersionId: "v",
      reportCheckedAt: NOW,
      latestChunkActivityAt: null,
      latestSourceDocumentUpdatedAt: null,
      latestSourceValidationCheckedAt: null,
      latestStructureCoverageCheckedAt: null,
      latestKnowledgeQualityCheckedAt: null,
    },
  };
}

function emptyModeSummary() {
  return {
    evaluatedResultCount: 5,
    pass: 5,
    warning: 0,
    fail: 0,
    hitRate: 1,
    meanReciprocalRank: 1,
    averageTopRank: 1,
    averageScore: 10,
  };
}

function passingRetrievalEvaluationSummary(): RetrievalEvaluationSummaryDto {
  return {
    set: { id: "s", name: "n", activeCaseCount: 5, updatedAt: NOW },
    latestRun: {
      id: "run",
      setId: "s",
      packId: "p",
      versionId: "v",
      status: "PASS",
      retrievalMode: "mixed",
      totalCaseCount: 5,
      evaluatedCaseCount: 5,
      passCaseCount: 5,
      warningCaseCount: 0,
      failCaseCount: 0,
      hitRate: 1,
      meanReciprocalRank: 1,
      caseHitRate: 1,
      caseMeanReciprocalRank: 1,
      evaluatedResultCount: 10,
      passResultCount: 10,
      warningResultCount: 0,
      failResultCount: 0,
      resultHitRate: 1,
      resultMeanReciprocalRank: 1,
      averageTopRank: 1,
      averageScore: 10,
      totalScore: 100,
      blockingIssueCount: 0,
      warningIssueCount: 0,
      summary: "ok",
      checkedBy: "SYSTEM",
      checkedAt: NOW,
      issues: [],
      modeSummary: {
        keyword: emptyModeSummary(),
        hybrid: emptyModeSummary(),
      },
    },
    freshness: {
      status: "CURRENT",
      reason: null,
      reasonCode: null,
      latestVersionId: "v",
      runVersionId: "v",
      runCheckedAt: NOW,
      activeSetId: "s",
      activeCaseCount: 5,
      latestCaseUpdatedAt: null,
      latestChunkActivityAt: null,
      latestSourceDocumentUpdatedAt: null,
      latestSourceValidationCheckedAt: null,
      latestStructureCoverageCheckedAt: null,
      latestKnowledgeQualityCheckedAt: null,
      latestChunkQualityCheckedAt: null,
    },
  };
}

function failingChunkQualitySummary(): ChunkQualitySummaryDto {
  const base = passingChunkQualitySummary();
  return {
    ...base,
    report: {
      ...base.report!,
      status: "FAIL",
      activeChunkCount: 0,
      blockingIssueCount: 1,
    },
  };
}

function basePack(overrides: Partial<ProviderPackDetailDto> = {}): ProviderPackDetailDto {
  return {
    packId: "p",
    name: "Pack",
    categoryId: "c",
    status: "DRAFT",
    pipelineStatus: "IDLE",
    pipelineUpdatedAt: null,
    shortDescription: "",
    description: "",
    tags: [],
    icon: "",
    pricing: "",
    providerName: "Provider",
    structureTemplateKey: "GENERIC_PRODUCT",
    structureQuality: null,
    chunkQuality: null,
    retrievalEvaluation: null,
    versions: [
      {
        id: "v",
        version: "0.1.0",
        overview: "",
        features: [],
        includedKnowledge: [],
        supportedEnvironments: [],
        targetUsers: [],
        useCases: [],
        versionSummary: "",
        sourceDocuments: [
          {
            id: "d1",
            title: "Doc",
            sourceType: "FILE",
            sourceFormat: "MARKDOWN",
            sourceUrl: null,
            productVersion: null,
            documentVersion: null,
            validationStatus: "PASS",
            validationSummary: null,
            validationScore: null,
            blockingIssueCount: 0,
            warningIssueCount: 0,
            validationIssues: [],
            createdAt: NOW,
          },
        ],
      },
    ],
    updatedAt: NOW,
    ...overrides,
  };
}

const readyInput = {
  sourceDocumentCount: 1,
  knowledgeUnitDraftCount: 2,
};

describe("provider review auto preparation helpers", () => {
  it("builds retrieval chunk content with minimum length and metadata parts", () => {
    const content = buildRetrievalChunkContent({
      title: "Grid",
      draftContent: "짧은 요약",
      sourceExcerpt: "원문 일부",
      sourcePath: "docs/guide.md",
    });
    assert.ok(content.length >= 120);
    assert.ok(content.includes("제목: Grid"));
    assert.ok(content.includes("원문 근거"));
    assert.ok(content.includes("출처: docs/guide.md"));
  });

  it("clamps oversized content", () => {
    const content = normalizeAndClamp("x".repeat(5000), 120, 4000);
    assert.ok(content.length <= 4000);
  });
});

describe("provider inspection user-facing readiness", () => {
  it("Case 3/4 style: not started → auto prepare CTA", () => {
    const readiness = buildProviderInspectionReadiness({
      pack: basePack(),
      ...readyInput,
    });
    assert.equal(readiness.userState, "auto_check_not_started");
    assert.equal(readiness.primaryActionKind, "RUN_AUTO_PREPARE");
    assert.equal(readiness.primaryActionLabel, "자동 점검 시작");
    assert.equal(readiness.nextActionLabel, "자동 점검 시작");
  });

  it("Case 4: chunk fail with reports → system fix available", () => {
    const readiness = buildProviderInspectionReadiness({
      pack: basePack({
        structureQuality: passingStructureQualitySummary(),
        chunkQuality: failingChunkQualitySummary(),
      }),
      ...readyInput,
    });
    assert.equal(readiness.userState, "system_fix_available");
    assert.equal(readiness.primaryActionKind, "REGENERATE_AND_CHECK");
    assert.equal(readiness.primaryActionLabel, "자동 재생성 및 점검");
  });

  it("Case 5: all checks done → review ready", () => {
    const readiness = buildProviderInspectionReadiness({
      pack: basePack({
        structureQuality: passingStructureQualitySummary(),
        chunkQuality: passingChunkQualitySummary(),
        retrievalEvaluation: passingRetrievalEvaluationSummary(),
      }),
      ...readyInput,
    });
    assert.equal(readiness.userState, "review_ready");
    assert.equal(readiness.primaryActionKind, "GO_TO_REVIEW");
    assert.equal(readiness.primaryActionLabel, "검수요청으로 이동");
    assert.equal(readiness.canSubmitReview, true);
  });
});
