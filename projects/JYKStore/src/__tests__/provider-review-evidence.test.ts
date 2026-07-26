import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildChunkIssueEvidence,
  buildProviderReviewAreaGuidance,
  buildRetrievalIssueEvidence,
  providerReviewConfirmBlockReason,
  providerReviewHasBlockingFail,
} from "../lib/provider-review-evidence.ts";

describe("provider review evidence", () => {
  it("joins SHORT_CHUNK with metric and source document", () => {
    const rows = buildChunkIssueEvidence({
      issues: [
        {
          severity: "WARNING",
          code: "SHORT_CHUNK",
          message: "내용이 짧은 chunk가 있습니다.",
          field: "chunk_000128",
          hint: "섹션: 셀 병합 | 미리보기: setSpan...",
        },
      ],
      metrics: [
        {
          chunkId: "chunk_000128",
          sourceDocumentId: "doc-1",
          title: "셀 병합",
          contentLength: 40,
          tokenEstimate: 10,
          status: "WARNING",
          issues: ["SHORT_CHUNK"],
        },
      ],
      sourceDocuments: [{ id: "doc-1", title: "rMate Grid for HTML5 사용 설명서.pdf" }],
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.issueTypeLabel, "짧은 chunk");
    assert.equal(rows[0]?.severityLabel, "주의 필요");
    assert.match(rows[0]?.locationLabel ?? "", /rMate Grid/);
    assert.equal(rows[0]?.targetId, "chunk_000128");
    assert.match(rows[0]?.problemPreview ?? "", /setSpan/);
    assert.match(rows[0]?.providerAction ?? "", /병합|보완 요청/);
    assert.equal(rows[0]?.hasConcreteEvidence, true);
    assert.equal(rows[0]?.sourceDocumentId, "doc-1");
  });

  it("marks missing evidence without inventing preview", () => {
    const rows = buildChunkIssueEvidence({
      issues: [
        {
          severity: "WARNING",
          code: "SHORT_CHUNK",
          message: "내용이 짧은 chunk가 있습니다.",
          field: null,
          hint: null,
        },
      ],
      metrics: [],
      sourceDocuments: [],
    });
    assert.equal(rows[0]?.hasConcreteEvidence, false);
    assert.match(rows[0]?.evidenceGapReason ?? "", /상세 근거 데이터 없음/);
  });

  it("builds area guidance and fail gate helpers", () => {
    const guidance = buildProviderReviewAreaGuidance({
      structureStatus: "PASS",
      chunkStatus: "WARNING",
      retrievalStatus: "FAIL",
      chunkIssueCount: 2,
      retrievalFailCount: 1,
    });
    assert.equal(guidance.length, 2);
    assert.ok(guidance.some((g) => g.areaLabel === "청킹" && g.statusLabel === "주의 필요"));
    assert.ok(guidance.some((g) => g.areaLabel === "검색 평가" && g.providerAction.includes("확인 완료할 수 없습니다")));
    assert.equal(
      providerReviewHasBlockingFail({
        structureStatus: "PASS",
        chunkStatus: "WARNING",
        retrievalStatus: "FAIL",
      }),
      true,
    );
  });

  it("blocks confirm when retrieval FAIL even if other reviews are complete", () => {
    const reason = providerReviewConfirmBlockReason({
      structureStatus: "PASS",
      chunkStatus: "PASS",
      retrievalStatus: "FAIL",
      structureReviewComplete: true,
      chunkReviewComplete: true,
      retrievalReviewComplete: true,
    });
    assert.match(reason ?? "", /실패 상태/);
  });

  it("blocks confirm until each attention chunk is reviewed", () => {
    const reason = providerReviewConfirmBlockReason({
      structureStatus: "PASS",
      chunkStatus: "WARNING",
      retrievalStatus: "PASS",
      structureReviewComplete: true,
      chunkReviewComplete: false,
      retrievalReviewComplete: true,
      unreviewedAttentionChunkCount: 4,
    });
    assert.match(reason ?? "", /남은 4건/);
  });

  it("blocks confirm until retrieval detail is reviewed", () => {
    const reason = providerReviewConfirmBlockReason({
      structureStatus: "PASS",
      chunkStatus: "PASS",
      retrievalStatus: "WARNING",
      structureReviewComplete: true,
      chunkReviewComplete: true,
      retrievalReviewComplete: false,
    });
    assert.match(reason ?? "", /검색 평가 실패 상세/);
  });

  it("builds retrieval issue evidence with problem data preview", () => {
    const rows = buildRetrievalIssueEvidence({
      failedResults: [
        {
          caseId: "case-1",
          retrievalMode: "hybrid",
          query: "셀 병합 API는 어떻게 쓰나요?",
          status: "FAIL",
          issueCodes: ["RETRIEVAL_EXPECTED_CHUNK_MISSING"],
          firstHitRank: null,
          hit: false,
        },
      ],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.sourceDocumentId, null);
    assert.match(rows[0]?.problemPreview ?? "", /질문:/);
    assert.match(rows[0]?.problemPreview ?? "", /RETRIEVAL_EXPECTED_CHUNK_MISSING/);
    assert.match(rows[0]?.serviceImpact ?? "", /기대 답변/);
  });
});
