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

describe("provider pack tabs UX sources", () => {
  it("defines five provider pack tabs with merged distribution and review", () => {
    const tabs = readSource("src/components/ProviderPackTabs.tsx");
    const editor = readSource("src/components/ProviderPackEditor.tsx");
    const tabIds = readSource("src/lib/provider-pack-tabs.ts");
    const copy = readSource("src/lib/role-based-ux-copy.ts");
    assert.ok(tabs.includes("PROVIDER_PACK_TAB_BASIC"));
    assert.ok(tabs.includes("PROVIDER_PACK_TAB_PAYLOAD"));
    assert.ok(tabs.includes("PROVIDER_PACK_TAB_KNOWLEDGE"));
    assert.ok(tabs.includes("PROVIDER_PACK_TAB_SERVICE_VALIDATION"));
    assert.ok(tabs.includes("PROVIDER_PACK_TAB_DISTRIBUTION_REVIEW"));
    assert.ok(!tabs.includes("PROVIDER_PACK_TAB_SOURCE"));
    assert.ok(!tabs.includes("PROVIDER_PACK_TAB_DRAFT"));
    assert.ok(!tabs.includes("PROVIDER_PACK_TAB_INSPECTION"));
    assert.ok(!tabs.includes("PROVIDER_PACK_TAB_PUBLISH"));
    assert.ok(copy.includes('데이터 구조화'));
    assert.ok(copy.includes('검색데이터 생성·검증'));
    assert.ok(copy.includes('유통정보·검수요청'));
    assert.ok(tabIds.includes('"basic"'));
    assert.ok(tabIds.includes('"payload"'));
    assert.ok(tabIds.includes('"knowledge"'));
    assert.ok(tabIds.includes('"serviceValidation"'));
    assert.ok(tabIds.includes('"distributionReview"'));
    assert.ok(!tabIds.includes('"review",'));
    assert.ok(tabIds.indexOf('"basic"') < tabIds.indexOf('"payload"'));
    assert.ok(tabIds.indexOf('"payload"') < tabIds.indexOf('"knowledge"'));
    assert.ok(tabIds.indexOf('"knowledge"') < tabIds.indexOf('"serviceValidation"'));
    assert.ok(tabIds.indexOf('"serviceValidation"') < tabIds.indexOf('"distributionReview"'));
    assert.ok(!editor.includes("ProviderPackTabs"));
    assert.ok(editor.includes("RoleWorkspaceShell"));
    assert.ok(editor.includes("getProviderPackRailState"));
    assert.ok(editor.includes("ProviderPayloadTab"));
    assert.ok(editor.includes("ProviderKnowledgeGenerationTab"));
    assert.ok(editor.includes("ProviderDistributionTab"));
    assert.ok(editor.includes("ProviderServiceValidationTab"));
    assert.ok(editor.includes("ProviderPackReviewTab"));
    assert.ok(editor.includes('activeTab === "basic"'));
    assert.ok(editor.includes('activeTab === "payload"'));
    assert.ok(editor.includes('activeTab === "knowledge"'));
    assert.ok(editor.includes('activeTab === "serviceValidation"'));
    assert.ok(editor.includes('activeTab === "distributionReview"'));
    assert.ok(!editor.includes('activeTab === "review"'));
    assert.ok(!editor.includes('activeTab === "distribution"'));
    assert.ok(editor.includes(': "hidden"'));
    assert.ok(editor.includes("cachedDoclingBundle"));
    assert.ok(tabs.includes("shortLabel") || tabs.includes("PROVIDER_PACK_TAB_BASIC_SHORT"));
    assert.ok(tabs.includes("aria-controls"));
  });

  it("keeps review panel free of Builder generation panels", () => {
    const review = readSource("src/components/ProviderPackReviewTab.tsx");
    assert.ok(!review.includes("StructureQualityPanel"));
    assert.ok(!review.includes("ChunkQualityPanel"));
    assert.ok(!review.includes("RetrievalEvaluationPanel"));
    assert.ok(!review.includes("evaluateProviderStructureQualityApi"));
    assert.ok(!review.includes("evaluateProviderChunkQualityApi"));
    assert.ok(!review.includes("generateProviderRetrievalEvaluationCasesApi"));
    assert.ok(!review.includes("runProviderRetrievalEvaluationApi"));
    assert.ok(!review.includes("PROVIDER_PACK_GO_TO_INSPECTION_REPAIR"));
    assert.ok(review.includes("PROVIDER_PACK_GO_TO_PAYLOAD_TAB"));
    assert.ok(review.includes("PROVIDER_SUBMIT_CTA"));
  });

  it("redirects legacy and renamed tab queries to the 5-step workflow", () => {
    const tabIds = readSource("src/lib/provider-pack-tabs.ts");
    assert.ok(tabIds.includes("LEGACY_PROVIDER_PACK_TAB_REDIRECT"));
    assert.ok(tabIds.includes('materials: "payload"'));
    assert.ok(tabIds.includes('source: "payload"'));
    assert.ok(tabIds.includes('draft: "payload"'));
    assert.ok(tabIds.includes('inspection: "distributionReview"'));
    assert.ok(tabIds.includes('distribution: "distributionReview"'));
    assert.ok(tabIds.includes('review: "distributionReview"'));
    assert.ok(tabIds.includes('"search-validation": "serviceValidation"'));
    assert.ok(tabIds.includes('"data-structure": "knowledge"'));
    assert.ok(tabIds.includes("#github-auto-collect"));
  });

  it("supports tab query navigation", () => {
    const editor = readSource("src/components/ProviderPackEditor.tsx");
    assert.ok(editor.includes('params.set("tab"'));
    assert.ok(editor.includes("resolveProviderPackTabFromLocation"));
  });

  it("moves main workflow steps to the left rail (no body step tabs)", () => {
    const editor = readSource("src/components/ProviderPackEditor.tsx");
    const zipCard = readSource(
      "src/components/provider-distribution/ProviderWorkerZipImportCard.tsx",
    );
    assert.ok(!editor.includes("<ProviderPackTabs"));
    assert.ok(editor.includes("RoleWorkspaceShell"));
    assert.ok(editor.includes("getProviderPackRailState"));
    assert.ok(zipCard.includes("자료 완료"));
    assert.ok(zipCard.includes("자료 미등록"));
    assert.ok(zipCard.includes("데이터 구조화 결과 확인"));
    assert.ok(zipCard.includes("자료 교체 업로드"));
    assert.ok(!zipCard.includes("자료 미완료"));
  });
});

describe("store responsive layout UX sources", () => {
  it("removes fixed mobile shell width", () => {
    const shell = readSource("src/components/MobileShell.tsx");
    const nav = readSource("src/components/BottomTabNav.tsx");
    assert.ok(shell.includes("max-w-[1120px]"));
    assert.ok(shell.includes("flex"));
    assert.ok(nav.includes("주요 메뉴"));
    assert.ok(!shell.includes("max-w-[430px]"));
    assert.ok(!nav.includes("max-w-[430px]"));
  });
});
