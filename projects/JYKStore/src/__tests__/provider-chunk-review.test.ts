import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildProviderChunkReviewItems,
  filterProviderChunkReviewItems,
  seedChangesRequestFromChunkReviewItem,
} from "../lib/provider-chunk-review.ts";

describe("provider chunk review view model", () => {
  it("builds source file, section, preview, reason, and action hint", () => {
    const items = buildProviderChunkReviewItems({
      metrics: [
        {
          chunkId: "chunk_000128",
          sourceDocumentId: "doc-1",
          title: "셀 병합",
          contentLength: 40,
          status: "WARNING",
          issues: ["SHORT_CHUNK"],
        },
      ],
      issues: [
        {
          severity: "WARNING",
          code: "SHORT_CHUNK",
          message: "내용이 짧은 chunk가 있습니다.",
          field: "chunk_000128",
          hint: "섹션: 셀 병합 API | 미리보기: setSpan을 사용해 병합합니다.",
        },
      ],
      sourceDocuments: [{ id: "doc-1", title: "rMate Grid for HTML5 사용 설명서.pdf" }],
    });

    assert.equal(items.length, 1);
    assert.equal(items[0]?.title, "셀 병합");
    assert.match(items[0]?.sourceFileName ?? "", /rMate Grid/);
    assert.deepEqual(items[0]?.sourceSectionPath, ["셀 병합 API"]);
    assert.match(items[0]?.contentPreview ?? "", /setSpan/);
    assert.match(items[0]?.issueReason ?? "", /검색 답변 근거로 부족/);
    assert.match(items[0]?.providerActionHint ?? "", /병합/);
    assert.equal(items[0]?.status, "warning");
    assert.equal(items[0]?.statusLabel, "주의 필요");
    assert.ok(items[0]?.issueTypes.includes("too_short"));
  });

  it("converts too_short into actionable copy instead of raw WARNING", () => {
    const items = buildProviderChunkReviewItems({
      metrics: [
        {
          chunkId: "c1",
          title: "Index",
          contentLength: 12,
          status: "WARNING",
          issues: ["SHORT_CHUNK"],
        },
      ],
      issues: [
        {
          severity: "WARNING",
          code: "SHORT_CHUNK",
          message: "내용이 짧은 chunk가 있습니다.",
          field: "c1",
          hint: null,
        },
      ],
    });
    assert.equal(items[0]?.statusLabel, "주의 필요");
    assert.match(items[0]?.issueReason ?? "", /본문이 짧아/);
    assert.ok(!items[0]?.issueReason.includes("WARNING"));
  });

  it("uses safe fallback when source locator is missing", () => {
    const items = buildProviderChunkReviewItems({
      metrics: [
        {
          chunkId: "orphan-1",
          title: "고아 단위",
          contentLength: 80,
          status: "PASS",
          issues: [],
        },
      ],
      issues: [],
      sourceDocuments: [],
    });
    assert.equal(items[0]?.status, "ok");
    assert.match(items[0]?.sourceFileName ?? "", /원본 위치/);
    assert.match(items[0]?.contentPreview ?? "", /상세 검토/);
  });

  it("filters attention rows and seeds changes request payload", () => {
    const items = buildProviderChunkReviewItems({
      metrics: [
        {
          chunkId: "ok-1",
          title: "정상",
          contentLength: 200,
          status: "PASS",
          issues: [],
          sourceDocumentId: "doc-1",
        },
        {
          chunkId: "warn-1",
          title: "짧음",
          contentLength: 20,
          status: "WARNING",
          issues: ["SHORT_CHUNK"],
          sourceDocumentId: "doc-1",
        },
      ],
      issues: [
        {
          severity: "WARNING",
          code: "SHORT_CHUNK",
          message: "내용이 짧은 chunk가 있습니다.",
          field: "warn-1",
          hint: "미리보기: foo",
        },
      ],
      sourceDocuments: [{ id: "doc-1", title: "guide.pdf" }],
    });

    const filtered = filterProviderChunkReviewItems(items, "warning");
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.chunkId, "warn-1");

    const seed = seedChangesRequestFromChunkReviewItem(filtered[0]!);
    assert.equal(seed.changeType, "CHUNKING");
    assert.equal(seed.targetKind, "CHUNK");
    assert.match(seed.targetLabel, /warn-1/);
    assert.match(seed.details, /지식 단위 ID/);
    assert.match(seed.details, /foo/);
  });
});
