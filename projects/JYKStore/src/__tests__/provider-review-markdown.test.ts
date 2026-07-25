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
      retrievalStatus: "PASS",
      warningCount: 1,
      failCount: 0,
      checkedAt: "2026-07-24T00:00:00.000Z",
      sourceDocuments: [{ title: "guide.pdf", sourceFormat: "PDF" }],
      chunkSamples: [{ chunkId: "c1", title: "셀 병합", contentLength: 40 }],
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
      ],
    });

    assert.match(md, /# 생성결과 내역/);
    assert.match(md, /\| 품질 요약 \| 주의 필요 \|/);
    assert.match(md, /guide\.pdf/);
    assert.match(md, /SHORT_CHUNK|짧은 chunk/);
    assert.match(md, /setSpan/);
  });
});
