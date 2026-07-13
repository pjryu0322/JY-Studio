import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DoclingImportBundleStatus } from "@prisma/client";
import {
  canRetry,
  canRetryDoclingBundle,
} from "../lib/docling-import/docling-import-state.ts";
import { detectLanguageFromText } from "../lib/docling-import/document-language.ts";
import { buildStructureSummary } from "../lib/docling-import/structure-summary.ts";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("P0-A.3 docling safe replace and staging", () => {
  it("replacement UX does not delete active on replace start", () => {
    const ui = readSource("src/components/provider-distribution/ProviderDoclingImportTab.tsx");
    assert.ok(ui.includes("onStartReplace"));
    assert.ok(ui.includes("새 파일로 교체"));
    assert.ok(ui.includes("등록 자료 삭제"));
    assert.ok(ui.includes("새 파일 검증이 완료되기 전까지 현재 Bundle은 유지됩니다"));
    assert.ok(!ui.includes("교체(재업로드)"));
    const startIdx = ui.indexOf("const onStartReplace");
    const startBlock = ui.slice(startIdx, startIdx + 400);
    assert.ok(!startBlock.includes("deleteProviderDoclingImportApi"));
  });

  it("blocks upload when live staging exists", () => {
    const service = readSource("src/lib/docling-import/docling-import-service.ts");
    assert.ok(service.includes("DOCLING_STAGING_BUNDLE_EXISTS"));
    assert.ok(service.includes("findLatestStagingBundleForVersion"));
  });

  it("submission history is bundle-id only", () => {
    const submission = readSource("src/lib/docling-import/docling-import-submission.ts");
    assert.ok(submission.includes("snap.doclingBundleId === bundleId"));
    assert.ok(!submission.includes("submittedVersionId === versionId"));
  });

  it("cleanup requires at least one succeeded job", () => {
    const life = readSource("src/lib/docling-import/docling-import-lifecycle-service.ts");
    assert.ok(life.includes("jobs.length >= 1"));
    assert.ok(life.includes("jobs.length === 0"));
  });

  it("canRetry considers error codes and storage", () => {
    assert.equal(canRetry(DoclingImportBundleStatus.VALIDATION_FAILED), true);
    assert.equal(
      canRetryDoclingBundle(
        DoclingImportBundleStatus.VALIDATION_FAILED,
        "SOURCE_FILENAME_MISMATCH",
      ),
      false,
    );
    assert.equal(
      canRetryDoclingBundle(
        DoclingImportBundleStatus.NORMALIZATION_FAILED,
        "DOCLING_STORAGE_UNAVAILABLE",
      ),
      true,
    );
  });

  it("detects Korean language from text", () => {
    const result = detectLanguageFromText(
      "소프트웨어 사업 대가산정 가이드는 공공기관의 사업 예산을 산정하는 기준입니다. ".repeat(5),
    );
    assert.equal(result.language, "ko");
    assert.equal(result.languageSource, "RULE_BASED");
  });

  it("builds structure summary with heading/paragraph split", () => {
    const summary = buildStructureSummary({
      sections: [
        { id: "1", title: "소개", level: 1, text: null, label: "section_header", sourceRef: "1", children: [] },
        { id: "2", title: null, level: null, text: "본문", label: "paragraph", sourceRef: "2", children: [] },
      ],
      tables: [{ caption: "표1" }],
      figures: [{ caption: null }],
      readingOrder: [{ index: 0 }],
    });
    assert.equal(summary.headingCount, 1);
    assert.equal(summary.paragraphCount, 1);
    assert.equal(summary.tableCount, 1);
    assert.equal(summary.figureCount, 1);
    assert.ok(summary.warnings.some((w) => /Caption/.test(w) || /Figure/.test(w)));
  });

  it("title match normalizes copy suffixes", async () => {
    const { evaluateDocumentTitleMatch } = await import("../lib/docling-import/title-match.ts");
    const result = evaluateDocumentTitleMatch({
      packName: "Sample Guide",
      documentTitle: "Sample Guide",
      sourceFileName: "sample-guide.pdf",
      originFileName: "sample-guide (1).pdf",
    });
    assert.ok(result.sourceVsOrigin === "MATCH" || result.sourceVsOrigin === "WARNING");
  });

  it("review submit blocks live staging", () => {
    const submit = readSource("src/lib/distribution/distribution-submit-service.ts");
    assert.ok(submit.includes("findLatestStagingBundleForVersion"));
    assert.ok(submit.includes("DOCLING_STAGING_BUNDLE_MUST_BE_RESOLVED") || submit.includes("Staging Bundle"));
    assert.ok(submit.includes("acquireVersionUploadLock"));
  });
});
