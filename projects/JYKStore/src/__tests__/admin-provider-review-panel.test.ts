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

describe("admin provider review workbench (publish gate)", () => {
  it("hosts provider review under the publish step", () => {
    const detail = readSource("src/components/AdminReviewDetailPageClient.tsx");
    const panel = readSource("src/components/AdminProviderReviewPanel.tsx");
    assert.ok(detail.includes("AdminProviderReviewPanel"));
    assert.ok(detail.includes("showPublish"));
    assert.ok(detail.includes("resolveAdminWorkflowStepQuery"));
    assert.ok(!detail.includes("제공자 확인 요청</button>"));
    assert.ok(panel.includes("제공자 검토 요청 전 확인"));
    assert.ok(!panel.includes("canRequestProviderReviewHandoff"));
    assert.ok(panel.includes("canRequestProviderReview"));
    assert.ok(!panel.includes("canRequestFromSnapshot"));
    assert.ok(detail.includes("canRequestProviderReview="));
    assert.ok(!detail.includes("canRequestFromSnapshot"));
    assert.ok(detail.includes("REQUEST_PROVIDER_REVIEW"));
    assert.ok(panel.includes("AdminProviderSupplementPanel"));
    assert.match(panel, /readonly canRequestProviderReview:\s*boolean/);
  });

  it("does not mount global supplement panel above the workbench", () => {
    const detail = readSource("src/components/AdminReviewDetailPageClient.tsx");
    assert.ok(!detail.includes("import { AdminProviderSupplementPanel }"));
    assert.ok(detail.includes("openSupplement"));
    assert.ok(detail.includes("AdminServiceValidationWorkbenchPanel"));
  });

  it("hides plain provider-review request form while supplement is open", () => {
    const panel = readSource("src/components/AdminProviderReviewPanel.tsx");
    assert.ok(panel.includes("!hasOpenSupplement"));
    assert.ok(panel.includes("isOpenProviderSupplementPhase"));
    assert.match(panel, /canSubmitRequest[\s\S]*!hasOpenSupplement/);
    assert.ok(!panel.includes("생성·품질보정으로 이동"));
  });

  it("quality panel summarizes gates and routes into correction", () => {
    const quality = readSource("src/components/AdminQualityCheckPanel.tsx");
    const detail = readSource("src/components/AdminReviewDetailPageClient.tsx");
    const card = readSource("src/components/AdminWorkerZipGenerationCard.tsx");
    assert.ok(quality.includes("품질점검 요약"));
    assert.ok(quality.includes("onScrollToQuality"));
    assert.ok(quality.includes("상세 결과로 이동"));
    assert.ok(quality.includes("완료") || quality.includes("상단"));
    assert.ok(card.includes("완료취소"));
    assert.ok(card.includes("onAcknowledgeQualityReview"));
    assert.ok(!quality.includes("위에서 확인하세요"));
    assert.ok(detail.includes("qualityResultsRevealKey"));
    assert.ok(detail.includes("setQualityResultsRevealKey"));
    assert.ok(card.includes('id="admin-quality-results"'));
    assert.ok(card.includes("revealKey"));
  });
});
