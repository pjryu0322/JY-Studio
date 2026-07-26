import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildProviderChunkReviewPdfChunkHtml,
  buildProviderChunkReviewPdfCoverHtml,
  buildProviderChunkReviewPdfHtml,
} from "../lib/provider-chunk-review-pdf.ts";
import type { ProviderChunkReviewItem } from "../lib/provider-chunk-review.ts";

function sampleItem(overrides: Partial<ProviderChunkReviewItem> = {}): ProviderChunkReviewItem {
  return {
    chunkId: "c1",
    title: "셀 병합",
    sourceFileName: "guide.pdf",
    sourceSectionPath: ["API"],
    contentPreview: "미리보기",
    charCount: 40,
    status: "warning",
    statusLabel: "주의 필요",
    issueTypes: ["too_short"],
    issueTypeLabels: ["본문이 짧음"],
    issueReason: "본문이 짧아 검색 근거로 부족할 수 있습니다.",
    providerActionHint: "확인하세요",
    sourceDocumentId: "doc-1",
    relatedIssueCodes: ["SHORT_CHUNK"],
    ...overrides,
  };
}

const sampleRow = {
  item: sampleItem(),
  detail: {
    chunkId: "c1",
    title: "셀 병합",
    content: "본문 <script>alert(1)</script>",
    contentTruncated: false,
    section: "API",
    tags: [] as string[],
    sortOrder: 1,
    sourceDocumentId: "doc-1",
    sourceFileName: "guide.pdf",
    sourceContentPreview: "원문 내용",
    sourceContentTruncated: false,
    prevChunkTitle: null,
    nextChunkTitle: null,
    knowledgeUnitId: null,
  },
};

describe("provider chunk review pdf", () => {
  it("builds printable html with title, status, body, and escaped content", () => {
    const html = buildProviderChunkReviewPdfHtml({
      packName: "리아모어 <test>",
      exportedAt: "2026. 7. 25.",
      rows: [sampleRow],
    });

    assert.match(html, /리아모어 &lt;test&gt;/);
    assert.match(html, /셀 병합/);
    assert.match(html, /주의 필요/);
    assert.match(html, /본문 &lt;script&gt;/);
    assert.match(html, /원문 내용/);
    assert.match(html, /이슈 사유/);
    assert.match(html, /서비스 영향/);
    assert.match(html, /제공자 조치/);
    assert.match(html, /확인하세요/);
    assert.match(html, /지식 단위 ID: c1/);
    assert.match(html, /<!-- pagebreak -->/);
  });

  it("builds one html document per chunk for page skips", () => {
    const cover = buildProviderChunkReviewPdfCoverHtml({
      packName: "팩",
      exportedAt: "오늘",
      count: 2,
    });
    const chunk1 = buildProviderChunkReviewPdfChunkHtml(sampleRow, 0);
    const chunk2 = buildProviderChunkReviewPdfChunkHtml(
      {
        ...sampleRow,
        item: sampleItem({ chunkId: "c2", title: "두번째" }),
        detail: { ...sampleRow.detail, chunkId: "c2", title: "두번째" },
      },
      1,
    );

    assert.match(cover, /검색 지식 단위 검토 내보내기/);
    assert.match(cover, /새 페이지/);
    assert.match(chunk1, /1\. 셀 병합/);
    assert.match(chunk2, /2\. 두번째/);
    assert.ok(!chunk1.includes("두번째"));
    assert.ok(!chunk2.includes("셀 병합"));
  });
});
