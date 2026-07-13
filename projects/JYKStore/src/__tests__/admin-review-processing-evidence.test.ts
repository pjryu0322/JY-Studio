import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ADMIN_REVIEW_EVIDENCE_TAB_IDS } from "../lib/admin-review-tabs.ts";
import { ADMIN_REVIEW_TAB_PROCESSING } from "../lib/role-based-ux-copy.ts";
import { buildExternalImportEvidenceFixture } from "../lib/review-evidence/review-processing-evidence-adapters.ts";
import { resolveApprovalPublishGuidance } from "../lib/review-evidence/review-processing-evidence-service.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("admin review generic processing evidence", () => {
  it("uses fixed processing tab without Docling tab id", () => {
    assert.deepEqual([...ADMIN_REVIEW_EVIDENCE_TAB_IDS], [
      "package",
      "warnings",
      "documents",
      "processing",
    ]);
    assert.equal(ADMIN_REVIEW_TAB_PROCESSING, "처리·검증");
  });

  it("renders Unstructured and JYKPackBuilder fixtures without UI changes", () => {
    const unstructured = buildExternalImportEvidenceFixture({
      generatorName: "Unstructured",
      adapterType: "UNSTRUCTURED",
    });
    assert.equal(unstructured.generator?.name, "Unstructured");
    assert.equal(unstructured.adapter?.type, "UNSTRUCTURED");
    assert.equal(unstructured.packageMode, "EXTERNAL_IMPORT");

    const builder = buildExternalImportEvidenceFixture({
      generatorName: "JYKPackBuilder",
      adapterType: "JYK_PACK_BUILDER",
    });
    assert.equal(builder.generator?.name, "JYKPackBuilder");
  });

  it("capability guidance avoids Context API when retrieval is NOT_BUILT", () => {
    const guidance = resolveApprovalPublishGuidance({
      capabilities: {
        download: { supported: true, status: "READY", reason: null },
        normalizedDocument: { supported: true, status: "READY", reason: null },
        retrieval: { supported: false, status: "NOT_BUILT", reason: null },
        context: { supported: false, status: "NOT_BUILT", reason: null },
        export: { supported: false, status: "NOT_BUILT", reason: null },
        mcp: { supported: false, status: "NOT_BUILT", reason: null },
      },
    });
    assert.ok(guidance.some((line) => line.includes("다운로드")));
    assert.ok(!guidance.some((line) => /Context API에 공개됩니다\.$/.test(line)));
  });

  it("documents tab avoids legacy empty copy for Docling imports", () => {
    const docs = readSource("src/components/AdminReviewSourceDocumentsTab.tsx");
    assert.ok(docs.includes("ADMIN_REVIEW_DOCUMENTS_EMPTY"));
    assert.ok(docs.includes("NormalizedDocumentPreview"));
    assert.ok(docs.includes("fetchAdminDoclingImportApi"));
    assert.ok(!docs.includes("등록된 원천 문서 없음"));
  });

  it("processing tab keeps logs and documents tab keeps preview", () => {
    const processing = readSource("src/components/AdminReviewProcessingEvidenceTab.tsx");
    const documents = readSource("src/components/AdminReviewSourceDocumentsTab.tsx");
    assert.ok(processing.includes("처리 로그"));
    assert.ok(!processing.includes("NormalizedDocumentPreview"));
    assert.ok(documents.includes("NormalizedDocumentPreview"));
    assert.ok(!documents.includes("processingLogs"));
  });
});
