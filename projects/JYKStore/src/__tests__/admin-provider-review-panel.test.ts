import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("admin provider review workbench (step3)", () => {
  it("isolates provider review into AdminProviderReviewPanel", () => {
    const detail = readSource("src/components/AdminReviewDetailPageClient.tsx");
    const panel = readSource("src/components/AdminProviderReviewPanel.tsx");
    assert.ok(detail.includes("AdminProviderReviewPanel"));
    assert.ok(detail.includes('activeStep === "providerConfirm"'));
    assert.ok(detail.includes("parseAdminReviewStep"));
    assert.ok(detail.includes("requestedStep ?? resolvedWorkflowStep"));
    assert.ok(!detail.includes("제공자 확인 요청</button>"));
    assert.ok(panel.includes("제공자 검토 요청 전 확인"));
    assert.ok(panel.includes("canRequestProviderReviewHandoff"));
    assert.ok(panel.includes("AdminProviderSupplementPanel"));
    assert.ok(panel.includes("Chunk 개별 수정"));
  });

  it("does not mount global supplement panel above the workbench", () => {
    const detail = readSource("src/components/AdminReviewDetailPageClient.tsx");
    assert.ok(!detail.includes("import { AdminProviderSupplementPanel }"));
    assert.ok(detail.includes("openSupplement"));
    assert.ok(detail.includes("보완요청이 처리되지 않아 서비스 검증"));
  });

  it("quality panel summarizes gates instead of placeholder-only copy", () => {
    const quality = readSource("src/components/AdminQualityCheckPanel.tsx");
    assert.ok(quality.includes("품질점검 요약"));
    assert.ok(quality.includes("onRerunQuality"));
    assert.ok(quality.includes("onScrollToQuality"));
    assert.ok(!quality.includes("위에서 확인하세요"));
  });
});
