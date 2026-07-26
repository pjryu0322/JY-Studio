import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildProviderGenerationReviewMarkdown } from "../lib/provider-review-markdown.ts";

describe("provider review markdown download", () => {
  it("builds a markdown table report for generation results", () => {
    const md = buildProviderGenerationReviewMarkdown({
      packId: "pack-1",
      packName: "Sample Pack",
      structureStatus: "PASS",
      chunkStatus: "WARNING",
      retrievalStatus: "FAIL",
      warningCount: 1,
      failCount: 1,
      checkedAt: "2026-07-24T00:00:00.000Z",
      sourceDocuments: [{ title: "guide.pdf", sourceFormat: "PDF" }],
      chunkReviewItems: [
        {
          chunkId: "c1",
          title: "셀 병합",
          locationLabel: "guide.pdf › 셀 병합",
          contentPreview: "setSpan으로 셀을 병합합니다.",
          issueReason: "본문이 너무 짧습니다.",
          serviceImpact: "검색 정확도 저하",
          providerAction: "원문 확인 후 보완 요청",
          reviewStatus: "검토 전",
        },
      ],
      guidance: [
        {
          area: "chunk",
          areaLabel: "청킹",
          statusLabel: "주의 필요",
          problem: "짧은 chunk",
          serviceImpact: "검색 정확도 저하",
          providerAction: "보완 요청",
        },
      ],
      issues: [
        {
          id: "1",
          area: "chunk",
          code: "SHORT_CHUNK",
          issueTypeLabel: "짧은 chunk",
          severityLabel: "주의 필요",
          message: "내용이 짧은 chunk가 있습니다.",
          locationLabel: "guide.pdf > 셀 병합",
          sourceDocumentId: "doc-1",
          targetId: "c1",
          problemPreview: "setSpan...",
          expectation: "기준",
          serviceImpact: "영향",
          providerAction: "조치",
          hasConcreteEvidence: true,
          evidenceGapReason: null,
          suggestedChangeType: "CHUNKING",
          suggestedTargetKind: "CHUNK",
          suggestedTargetLabel: "c1",
        },
        {
          id: "r1",
          area: "retrieval",
          code: "RETRIEVAL_FAIL",
          issueTypeLabel: "검색 결과 부정확",
          severityLabel: "실패",
          message: "검색 평가 실패",
          locationLabel: "셀 병합 API는 어떻게 쓰나요?",
          sourceDocumentId: null,
          targetId: "case-1",
          problemPreview: "질문: 셀 병합 API는 어떻게 쓰나요?",
          expectation: "기대 chunk 연결",
          serviceImpact: "검색 실패",
          providerAction: "보완 요청",
          hasConcreteEvidence: true,
          evidenceGapReason: null,
          suggestedChangeType: "RETRIEVAL",
          suggestedTargetKind: "QUERY",
          suggestedTargetLabel: "셀 병합 API는 어떻게 쓰나요?",
        },
      ],
    });

    assert.match(md, /# 생성결과 내역/);
    assert.match(md, /\| 품질 요약 \| 실패 \|/);
    assert.match(md, /guide\.pdf/);
    assert.match(md, /지식단위\/Chunk 검토 상세/);
    assert.doesNotMatch(md, /## Chunk 샘플/);
    assert.match(md, /원본 위치/);
    assert.match(md, /본문 미리보기/);
    assert.match(md, /이슈 사유/);
    assert.match(md, /서비스 영향/);
    assert.match(md, /제공자 조치/);
    assert.match(md, /setSpan으로 셀을 병합합니다/);
    assert.match(md, /SHORT_CHUNK|짧은 chunk/);
    assert.match(md, /검색 평가/);
    assert.match(md, /셀 병합 API는 어떻게 쓰나요/);
  });
});
