import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  areKuDraftTitlesSimilar,
  dedupeKuDraftCandidates,
  isKuDraftDuplicate,
} from "../lib/knowledge-unit-draft/ku-draft-dedup.ts";
import {
  buildKuProcessingNarrative,
  buildKuProcessingSummary,
} from "../lib/knowledge-unit-draft/ku-draft-processing-status.ts";
import { parseUserFacingKuDraftContent } from "../lib/knowledge-unit-draft/ku-draft-content.ts";
import { classifySourceDocumentForKuGeneration } from "../lib/knowledge-unit-draft/ku-draft-skip-reasons.ts";

const longContent = "x".repeat(80);

function githubDoc(path: string, content: string) {
  return {
    id: path,
    title: path,
    sourceUrl: `https://github.com/a/b/blob/main/${path}`,
    fileName: path,
    content,
    validationStatus: "PASS",
    validationSummary: null,
  };
}

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

describe("ku-draft-skip-reasons", () => {
  it("classifies package.json as excluded METADATA_FILE", () => {
    const result = classifySourceDocumentForKuGeneration(
      githubDoc("package.json", longContent),
    );
    assert.deepEqual(result, {
      reasonCode: "METADATA_FILE",
      status: "excluded",
    });
  });

  it("classifies LICENSE as excluded LICENSE_FILE", () => {
    const result = classifySourceDocumentForKuGeneration(githubDoc("LICENSE", longContent));
    assert.equal(result?.reasonCode, "LICENSE_FILE");
    assert.equal(result?.status, "excluded");
  });

  it("classifies lock files as excluded LOCK_FILE", () => {
    assert.equal(
      classifySourceDocumentForKuGeneration(githubDoc("yarn.lock", longContent))?.reasonCode,
      "LOCK_FILE",
    );
    assert.equal(
      classifySourceDocumentForKuGeneration(githubDoc("package-lock.json", longContent))
        ?.reasonCode,
      "LOCK_FILE",
    );
  });
});

describe("ku-draft-processing-status", () => {
  it("builds processing summary counts", () => {
    const result = buildKuProcessingSummary(
      [
        githubDoc("README.md", longContent),
        githubDoc("package.json", longContent),
      ],
      new Map([["README.md", [{ title: "제품 개요", reviewStatus: "pending_review" }]]]),
    );

    assert.equal(result.summary.sourceDocumentTotal, 2);
    assert.equal(result.summary.generated, 1);
    assert.equal(result.summary.excluded, 1);
    assert.equal(result.summary.failed, 0);
    assert.equal(result.documents[1]?.reasonCode, "METADATA_FILE");
  });

  it("uses processed progress when many documents are excluded", () => {
    const docs = [
      ...Array.from({ length: 8 }, (_, i) => githubDoc(`docs/doc-${i}.md`, longContent)),
      ...Array.from({ length: 22 }, (_, i) =>
        githubDoc(`packages/pkg-${i}/package.json`, longContent),
      ),
    ];
    const drafts = new Map<string, { title: string; reviewStatus: string }[]>();
    for (let i = 0; i < 8; i += 1) {
      drafts.set(`docs/doc-${i}.md`, [{ title: "Unit", reviewStatus: "pending_review" }]);
    }

    const result = buildKuProcessingSummary(docs, drafts);
    assert.equal(result.summary.generated, 8);
    assert.equal(result.summary.excluded, 22);
    assert.equal(result.summary.failed, 0);
    assert.equal(result.summary.progressPercent, 100);
  });

  it("builds narrative without failure wording when failed is zero", () => {
    const narrative = buildKuProcessingNarrative({
      sourceDocumentTotal: 30,
      generated: 8,
      duplicate: 0,
      excluded: 22,
      unsupported: 0,
      failed: 0,
      progressPercent: 100,
    });
    assert.match(narrative, /실제 처리 실패는 없습니다/);
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
