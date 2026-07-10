import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  areKuDraftTitlesSimilar,
  dedupeKuDraftCandidates,
  isKuDraftDuplicate,
} from "../lib/knowledge-unit-draft/ku-draft-dedup.ts";
import { buildKuProcessingSummary } from "../lib/knowledge-unit-draft/ku-draft-processing-status.ts";
import { parseUserFacingKuDraftContent } from "../lib/knowledge-unit-draft/ku-draft-content.ts";

describe("ku-draft-dedup", () => {
  it("detects similar titles and duplicate checksums", () => {
    assert.equal(areKuDraftTitlesSimilar("getting-started", "Getting Started"), true);
    assert.equal(
      isKuDraftDuplicate(
        {
          sourceDocumentId: "doc-1",
          title: "Install",
          sourcePath: "docs/getting-started.md",
          primaryHeading: "Install",
          contentChecksum: "abc",
        },
        {
          sourceDocumentId: "doc-1",
          title: "Install guide",
          sourcePath: "docs/getting-started.md",
          primaryHeading: "Install",
          contentChecksum: "abc",
        },
      ),
      true,
    );
  });

  it("dedupes candidates in batch", () => {
    const { kept, mergedCount } = dedupeKuDraftCandidates([
      {
        sourceDocumentId: "doc-1",
        title: "Grid",
        sourcePath: "docs/grid.md",
        primaryHeading: "Grid",
        contentChecksum: "1",
      },
      {
        sourceDocumentId: "doc-1",
        title: "Grid",
        sourcePath: "docs/grid.md",
        primaryHeading: "Grid",
        contentChecksum: "2",
      },
    ]);
    assert.equal(kept.length, 1);
    assert.equal(mergedCount, 1);
  });
});

describe("ku-draft-processing-status", () => {
  it("builds processing summary counts", () => {
    const result = buildKuProcessingSummary(
      [
        {
          id: "d1",
          title: "README",
          sourceUrl: "https://github.com/a/b/blob/main/README.md",
          fileName: "README.md",
          content: "x".repeat(80),
          validationStatus: "PASS",
          validationSummary: null,
        },
        {
          id: "d2",
          title: "package.json",
          sourceUrl: "https://github.com/a/b/blob/main/package.json",
          fileName: "package.json",
          content: "{}",
          validationStatus: "PASS",
          validationSummary: null,
        },
      ],
      new Map([["d1", [{ title: "제품 개요", reviewStatus: "pending_review" }]]]),
    );

    assert.equal(result.summary.sourceDocumentTotal, 2);
    assert.equal(result.summary.documentsGenerated, 1);
    assert.equal(result.summary.excluded, 1);
  });
});

describe("ku-draft-content", () => {
  it("parses user-facing draft sections", () => {
    const parsed = parseUserFacingKuDraftContent(
      "## 설명\n설치 방법\n\n## 핵심 내용\n- NPM\n- CDN\n\n## 관련 Unit\n- Import",
    );
    assert.equal(parsed.description, "설치 방법");
    assert.deepEqual(parsed.keyPoints, ["NPM", "CDN"]);
    assert.deepEqual(parsed.relatedUnits, ["Import"]);
  });
});
