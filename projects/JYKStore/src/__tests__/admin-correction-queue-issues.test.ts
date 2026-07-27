import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import { buildCorrectionQueueIssues } from "@/lib/admin-correction-queue-issues";
import type { AdminQualityGateSnapshot } from "@/lib/role-workspace/admin-review-rail";

function makeDetail(warningDocs: { id: string; title: string }[]): AdminReviewDetailDto {
  return {
    pack: {
      packId: "pack-1",
      name: "테스트팩",
      providerName: "P",
      providerType: "ORG",
      categoryId: null,
      status: "REVIEWING",
      pricing: "FREE",
      icon: null,
      shortDescription: "",
      description: "",
      tags: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    versions: [
      {
        id: "ver-1",
        version: "1.0",
        overview: "",
        features: [],
        includedKnowledge: [],
        supportedEnvironments: [],
        targetUsers: [],
        useCases: [],
        versionSummary: "",
        language: null,
        sourceDocuments: warningDocs.map((doc) => ({
          id: doc.id,
          title: doc.title,
          sourceType: "MANUAL",
          sourceFormat: "MD",
          sourceUrl: null,
          productVersion: null,
          documentVersion: null,
          validationStatus: "WARNING",
          validationSummary: `${doc.title} 검증 주의`,
          validationScore: null,
          blockingIssueCount: 0,
          warningIssueCount: 1,
          validationIssues: [],
          contentPreview: `preview:${doc.id}`,
          createdAt: "2026-01-01T00:00:00.000Z",
        })),
      },
    ],
    latestReview: null,
    payload: null,
    currentManifestFingerprint: null,
    doclingReviewIntegrity: null,
    distribution: null,
    artifactOptions: null,
    readiness: {
      versionCount: 1,
      sourceDocumentCount: warningDocs.length,
      hasRequiredDescription: true,
      canApprove: false,
      pipelineStatus: "READY",
      sourceValidation: {
        passCount: 0,
        warningCount: warningDocs.length,
        failCount: 0,
        notCheckedCount: 0,
      },
      sourceTypeCoverage: {},
      structureCoverageStatus: "WARNING",
      knowledgeQualityStatus: "WARNING",
      structureQualityMessage: null,
      chunkQualityStatus: "WARNING",
      chunkQualityMessage: null,
      retrievalEvaluationStatus: "FAIL",
      retrievalEvaluationMessage: null,
      releaseGateStatus: "FAIL",
      releaseGateMessage: null,
    },
    structureQuality: null,
    chunkQuality: null,
    retrievalEvaluation: null,
    releaseGate: null,
  };
}

describe("buildCorrectionQueueIssues", () => {
  it("expands each WARNING source document into its own warning queue item", () => {
    const docs = Array.from({ length: 39 }, (_, i) => ({
      id: `doc-${i + 1}`,
      title: `문서 ${i + 1}`,
    }));
    const detail = makeDetail(docs);
    const quality: AdminQualityGateSnapshot = {
      completed: true,
      failCount: 0,
      hasBlockers: true,
      hasWarnings: true,
      blockers: ["릴리스 게이트가 FAIL입니다."],
      warnings: [
        `원천 문서 ${docs.length}개가 WARNING 상태입니다.`,
        "청킹 품질이 WARNING입니다.",
      ],
    };

    const issues = buildCorrectionQueueIssues(quality, detail);
    const warnings = issues.filter((i) => i.severity === "warning");
    const sourceWarnings = warnings.filter((i) => i.category === "sourceDocument");

    assert.equal(sourceWarnings.length, 39);
    assert.equal(warnings.length, 40); // 39 docs + chunking summary
    assert.ok(!warnings.some((w) => /원천 문서 \d+개가 WARNING/.test(w.raw)));
    assert.equal(sourceWarnings[0]?.title, "문서 1");
    assert.equal(sourceWarnings[0]?.contentPreview, "preview:doc-1");
  });

  it("omits license-like WARNING source documents from the correction queue", () => {
    const detail = makeDetail([
      { id: "doc-1", title: "가이드" },
      { id: "doc-2", title: "라이선스" },
      { id: "doc-3", title: "main.2d074fad.js.LICENSE" },
    ]);
    const quality: AdminQualityGateSnapshot = {
      completed: true,
      failCount: 0,
      hasBlockers: false,
      hasWarnings: true,
      blockers: [],
      warnings: ["원천 문서 3개가 WARNING 상태입니다."],
    };

    const issues = buildCorrectionQueueIssues(quality, detail);
    const sourceWarnings = issues.filter((i) => i.category === "sourceDocument");
    assert.equal(sourceWarnings.length, 1);
    assert.equal(sourceWarnings[0]?.title, "가이드");
  });
});
