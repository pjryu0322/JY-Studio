import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateRetrievalEvaluationPreflight } from "@/lib/retrieval-evaluation/retrieval-evaluation-preflight";
import { generateRetrievalEvaluationCases } from "@/lib/retrieval-evaluation/retrieval-evaluation-case-generator";
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
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const NOW = "2026-07-08T12:00:00.000Z";
const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

describe("retrieval evaluation preflight", () => {
  it("Case 1: insufficient active chunks blocks evaluation", () => {
    const result = evaluateRetrievalEvaluationPreflight({
      activeChunkCount: 1,
      activeChunkIds: ["c1"],
      activeChunkSourceDocumentIds: ["d1"],
      activeCases: Array.from({ length: 6 }, (_, i) => ({
        query: `q${i}`,
        expectedChunkIds: [],
        expectedSourceDocumentIds: ["d1"],
      })),
    });
    assert.equal(result.ready, false);
    assert.equal(result.status, "chunk_insufficient");
    assert.equal(result.recommendedAction, "regenerate_chunks_and_cases");
  });

  it("marks cases without expected source as not ready", () => {
    const result = evaluateRetrievalEvaluationPreflight({
      activeChunkCount: 3,
      activeChunkIds: ["c1", "c2", "c3"],
      activeChunkSourceDocumentIds: ["d1"],
      activeCases: [
        { query: "설치하기", expectedChunkIds: ["c1"], expectedSourceDocumentIds: ["d1"] },
        { query: "api", expectedChunkIds: [], expectedSourceDocumentIds: [] },
      ],
    });
    assert.equal(result.ready, false);
    assert.equal(result.status, "case_without_expected_source");
    assert.equal(result.recommendedAction, "regenerate_cases");
  });
});

describe("retrieval case generator scope", () => {
  it("Case 3: skips banned/unmapped queries and prefers active chunks", () => {
    const cases = generateRetrievalEvaluationCases({
      structureSections: [],
      sources: [
        { id: "d1", title: "Guide", sourceType: "PRODUCT_MANUAL", validationStatus: "PASS" },
      ],
      chunks: [
        {
          id: "c1",
          title: "설치하기",
          section: "Install",
          tags: ["install"],
          sourceDocumentId: "d1",
          isActive: true,
          sourceType: "PRODUCT_MANUAL",
        },
        {
          id: "c2",
          title: "기본 사용법",
          section: "Usage",
          tags: ["usage"],
          sourceDocumentId: "d1",
          isActive: true,
          sourceType: "PRODUCT_MANUAL",
        },
      ],
      maxCases: 10,
    });
    assert.ok(cases.some((c) => c.query.includes("설치하기")));
    assert.ok(cases.every((c) => c.expectedChunkIds.length > 0 || c.expectedSourceDocumentIds.length > 0));
    assert.ok(!cases.some((c) => c.query.toLowerCase() === "api"));
    assert.ok(!cases.some((c) => c.query.toLowerCase() === "error"));
  });
});

function createAutoChunkMockPrisma(docCount: number, draftCount: number) {
  const created: Array<Record<string, unknown>> = [];
  const docs = Array.from({ length: docCount }, (_, i) => ({
    id: `doc-${i + 1}`,
    title: `Guide ${i + 1}`,
    content: `# Heading ${i + 1}\n\n${"본문 내용입니다. ".repeat(40)}\n\n## Detail\n\n${"추가 설명입니다. ".repeat(30)}`,
    validationStatus: "PASS",
    fileName: `docs/guide-${i + 1}.md`,
    sourceUrl: `https://github.com/test/repo/blob/main/docs/guide-${i + 1}.md`,
  }));
  const drafts = Array.from({ length: draftCount }, (_, i) => ({
    id: `draft-${i + 1}`,
    versionId: "ver-1",
    sourceDocumentId: docs[0]!.id,
    chunkType: AUTO_KNOWLEDGE_UNIT_DRAFT_CHUNK_TYPE,
    title: i === 0 ? "설치하기" : `Draft ${i + 1}`,
    content: "짧은 초안",
    section: "Install",
    tags: ["install"],
    isActive: false,
    metadata: {
      reviewStatus: "pending_review",
      sourcePath: docs[0]!.fileName,
      topic: "Install",
      evidence: { excerpt: "npm install 으로 설치합니다. TOAST UI Grid 설치 방법" },
    },
  }));

  const db = {
    knowledgePack: {
      findFirst: async () => ({
        packId: "pack-1",
        versions: [{ id: "ver-1", sourceDocuments: docs, chunks: drafts }],
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
  it("Case 2: reinforces fallback chunks when drafts are few", async () => {
    const { db, created } = createAutoChunkMockPrisma(6, 1);
    const result = await regenerateAutoChunksForPack(
      { packId: "pack-1", mode: "hybrid", replace: true, reinforce: true },
      { prismaClient: db },
    );
    assert.equal("ok" in result && result.ok, true);
    if (!("ok" in result)) return;
    assert.ok(result.createdChunkCount >= 3);
    assert.ok(created.length >= 3);
    assert.ok(
      created.some(
        (c) =>
          c.chunkType === AUTO_KNOWLEDGE_UNIT_CHUNK_TYPE ||
          c.chunkType === AUTO_SOURCE_CHUNK_TYPE,
      ),
    );
    for (const chunk of created) {
      assert.equal(chunk.isActive, true);
      const meta = chunk.metadata as Record<string, unknown>;
      assert.equal(meta.generatedBy, AUTO_PIPELINE_GENERATED_BY);
    }
  });

  it("does not pad content with boilerplate filler", () => {
    const content = buildRetrievalChunkContent({
      title: "Grid",
      draftContent: "짧은 요약",
      sourceExcerpt: "원문",
      sourcePath: "docs/guide.md",
    });
    assert.ok(!content.includes("검색·검수에 사용할 수 있도록"));
    assert.ok(content.includes("제목: Grid"));
    const clamped = normalizeAndClamp("짧음", 120, 4000);
    assert.ok(clamped.length < 120);
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

function passingChunkQualitySummary(activeChunkCount = 1): ChunkQualitySummaryDto {
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
      activeChunkCount,
      inactiveChunkCount: 4,
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

function failingRetrievalEvaluationSummary(): RetrievalEvaluationSummaryDto {
  return {
    set: { id: "s", name: "n", activeCaseCount: 6, updatedAt: NOW },
    latestRun: {
      id: "run",
      setId: "s",
      packId: "p",
      versionId: "v",
      status: "FAIL",
      retrievalMode: "mixed",
      totalCaseCount: 6,
      evaluatedCaseCount: 6,
      passCaseCount: 3,
      warningCaseCount: 0,
      failCaseCount: 3,
      hitRate: 0.5,
      meanReciprocalRank: 0.5,
      caseHitRate: 0.5,
      caseMeanReciprocalRank: 0.5,
      evaluatedResultCount: 12,
      passResultCount: 6,
      warningResultCount: 0,
      failResultCount: 6,
      resultHitRate: 0.5,
      resultMeanReciprocalRank: 0.5,
      averageTopRank: 1,
      averageScore: 10,
      totalScore: 50,
      blockingIssueCount: 1,
      warningIssueCount: 0,
      summary: "fail",
      checkedBy: "SYSTEM",
      checkedAt: NOW,
      issues: [],
      modeSummary: {
        keyword: emptyModeSummary(),
        hybrid: emptyModeSummary(),
      },
      failedResults: [
        {
          caseId: "c1",
          query: "api",
          retrievalMode: "keyword",
          status: "FAIL",
          issueCodes: ["RETRIEVAL_EXPECTED_SOURCE_MISSING"],
          firstHitRank: null,
        },
      ],
    },
    freshness: {
      status: "CURRENT",
      reason: null,
      reasonCode: null,
      latestVersionId: "v",
      runVersionId: "v",
      runCheckedAt: NOW,
      activeSetId: "s",
      activeCaseCount: 6,
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
    latestRejectionReason: null,
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

describe("provider inspection retrieval repair UX", () => {
  it("Case 5: retrieval FAIL shows single repair CTA", () => {
    const readiness = buildProviderInspectionReadiness({
      pack: basePack({
        structureQuality: passingStructureQualitySummary(),
        chunkQuality: passingChunkQualitySummary(1),
        retrievalEvaluation: failingRetrievalEvaluationSummary(),
      }),
      sourceDocumentCount: 1,
      knowledgeUnitDraftCount: 2,
    });
    assert.equal(readiness.userTitle, "검색 품질 점검 결과: 보완 필요");
    assert.equal(readiness.primaryActionLabel, "검색용 데이터 자동 보완");
    assert.equal(readiness.primaryActionKind, "REPAIR_RETRIEVAL_DATA");
    assert.ok(readiness.fixNeededTitles.every((t) => !t.includes("RETRIEVAL_")));
  });

  it("Case 6: RetrievalEvaluationPanel hides detailed metrics behind details", () => {
    const panel = readFileSync(
      join(projectRoot, "src/components/RetrievalEvaluationPanel.tsx"),
      "utf8",
    );
    assert.ok(panel.includes("상세 검색 품질 지표"));
    assert.ok(panel.includes("<details"));
    assert.ok(panel.includes("검색용 데이터 자동 보완"));
    const beforeDetails = panel.slice(0, panel.indexOf("상세 검색 품질 지표"));
    assert.ok(!beforeDetails.includes("Case Hit Rate"));
    assert.ok(!beforeDetails.includes("Case MRR"));
  });
});
