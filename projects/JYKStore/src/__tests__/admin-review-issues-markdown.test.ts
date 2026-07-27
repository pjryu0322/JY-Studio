import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import { buildReviewIssuesDetailMarkdown } from "@/lib/admin-review-issues-markdown";

function makeDetail(): AdminReviewDetailDto {
  return {
    pack: {
      packId: "pack-1",
      name: "테스트팩",
      providerName: "P",
      providerType: "ORG",
      categoryId: "cat",
      status: "REVIEWING",
      pricing: "FREE",
      icon: "",
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
        sourceDocuments: [
          {
            id: "doc-warn",
            title: "샘플 가이드",
            sourceType: "PRODUCT_MANUAL",
            sourceFormat: "HTML",
            sourceUrl: null,
            productVersion: "6.0",
            documentVersion: null,
            validationStatus: "WARNING",
            validationSummary: "주의 1건: ONLY_ETC_TYPE",
            validationScore: 90,
            blockingIssueCount: 0,
            warningIssueCount: 1,
            validationIssues: [
              {
                severity: "WARNING",
                code: "ONLY_ETC_TYPE",
                message: "자료 유형이 ETC로만 분류되었습니다.",
                field: "sourceType",
                hint: "유형을 재분류하세요.",
              },
            ],
            contentPreview: "미리보기 본문입니다.",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "doc-license",
            title: "라이선스",
            sourceType: "ETC",
            sourceFormat: "TEXT",
            sourceUrl: null,
            productVersion: null,
            documentVersion: null,
            validationStatus: "WARNING",
            validationSummary: "라이선스 경고",
            validationScore: null,
            blockingIssueCount: 0,
            warningIssueCount: 1,
            validationIssues: [],
            contentPreview: null,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
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
      sourceDocumentCount: 2,
      hasRequiredDescription: true,
      canApprove: false,
      pipelineStatus: "READY",
      sourceValidation: {
        passCount: 0,
        warningCount: 2,
        failCount: 0,
        notCheckedCount: 0,
      },
      sourceTypeCoverage: {},
      structureCoverageStatus: "PASS",
      knowledgeQualityStatus: "WARNING",
      structureQualityMessage: "구조 메시지 상세",
      chunkQualityStatus: "WARNING",
      chunkQualityMessage: "청킹 메시지 상세",
      retrievalEvaluationStatus: "FAIL",
      retrievalEvaluationMessage:
        "검색 품질 평가(FAIL) 결과로 제출할 수 없습니다. 평가 케이스 또는 청크/검색 품질을 보완하세요.",
      releaseGateStatus: "FAIL",
      releaseGateMessage: "릴리스 게이트가 FAIL입니다.",
    },
    structureQuality: null,
    chunkQuality: null,
    retrievalEvaluation: null,
    releaseGate: null,
  };
}

describe("buildReviewIssuesDetailMarkdown", () => {
  it("exports blocker/warning text and per-document WARNING details", () => {
    const md = buildReviewIssuesDetailMarkdown({
      detail: makeDetail(),
      exportedAt: "2026-07-27T00:00:00.000Z",
    });

    assert.match(md, /# 차단\/주의 이슈 상세/);
    assert.match(md, /테스트팩/);
    assert.match(md, /검색 품질 평가\(FAIL\)/);
    assert.match(md, /릴리스 게이트가 FAIL/);
    assert.match(md, /## 원천 검증 WARNING 문서 상세/);
    assert.match(md, /샘플 가이드/);
    assert.match(md, /ONLY_ETC_TYPE/);
    assert.match(md, /자료 유형이 ETC로만 분류/);
    assert.match(md, /미리보기 본문/);
    assert.match(md, /구조 메시지 상세/);
    assert.match(md, /청킹 메시지 상세/);
    assert.doesNotMatch(md, /#### .*라이선스/);
  });
});
