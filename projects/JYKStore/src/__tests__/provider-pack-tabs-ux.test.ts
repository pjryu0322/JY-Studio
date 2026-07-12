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
  it("defines three provider pack tabs: basic, materials, review", () => {
    const tabs = readSource("src/components/ProviderPackTabs.tsx");
    const editor = readSource("src/components/ProviderPackEditor.tsx");
    const tabIds = readSource("src/lib/provider-pack-tabs.ts");
    assert.ok(tabs.includes("PROVIDER_PACK_TAB_BASIC"));
    assert.ok(tabs.includes("PROVIDER_PACK_TAB_MATERIALS"));
    assert.ok(tabs.includes("PROVIDER_PACK_TAB_REVIEW"));
    assert.ok(!tabs.includes("PROVIDER_PACK_TAB_SOURCE"));
    assert.ok(!tabs.includes("PROVIDER_PACK_TAB_DRAFT"));
    assert.ok(!tabs.includes("PROVIDER_PACK_TAB_INSPECTION"));
    assert.ok(!tabs.includes("PROVIDER_PACK_TAB_PUBLISH"));
    assert.ok(tabIds.includes('"basic"'));
    assert.ok(tabIds.includes('"materials"'));
    assert.ok(tabIds.includes('"review"'));
    assert.ok(tabIds.indexOf('"basic"') < tabIds.indexOf('"materials"'));
    assert.ok(tabIds.indexOf('"materials"') < tabIds.indexOf('"review"'));
    assert.ok(editor.includes("ProviderPackTabs"));
    assert.ok(editor.includes("ProviderPackMaterialsTab"));
    assert.ok(editor.includes("ProviderPackReviewTab"));
    assert.ok(!editor.includes("ProviderPackInspectionTab"));
    assert.ok(!editor.includes("ProviderPackSourceStep"));
    assert.ok(!editor.includes("ProviderGitHubAutoCollectPanel"));
    assert.ok(editor.includes('activeTab === "basic"'));
    assert.ok(editor.includes('activeTab === "materials"'));
    assert.ok(editor.includes('activeTab === "review"'));
  });

  it("keeps review tab free of Builder generation panels", () => {
    const review = readSource("src/components/ProviderPackReviewTab.tsx");
    const materials = readSource("src/components/ProviderPackMaterialsTab.tsx");
    assert.ok(!review.includes("StructureQualityPanel"));
    assert.ok(!review.includes("ChunkQualityPanel"));
    assert.ok(!review.includes("RetrievalEvaluationPanel"));
    assert.ok(!review.includes("evaluateProviderStructureQualityApi"));
    assert.ok(!review.includes("evaluateProviderChunkQualityApi"));
    assert.ok(!review.includes("generateProviderRetrievalEvaluationCasesApi"));
    assert.ok(!review.includes("runProviderRetrievalEvaluationApi"));
    assert.ok(!review.includes("PROVIDER_PACK_GO_TO_INSPECTION_REPAIR"));
    assert.ok(review.includes("PROVIDER_PACK_GO_TO_MATERIALS_TAB"));
    assert.ok(review.includes("PROVIDER_SUBMIT_CTA"));
    assert.ok(materials.includes("PROVIDER_PACK_MATERIALS_TITLE"));
    assert.ok(materials.includes("PROVIDER_PACK_GO_TO_REVIEW_TAB"));
  });

  it("redirects legacy builder tab queries", () => {
    const tabIds = readSource("src/lib/provider-pack-tabs.ts");
    assert.ok(tabIds.includes("LEGACY_PROVIDER_PACK_TAB_REDIRECT"));
    assert.ok(tabIds.includes('source: "materials"'));
    assert.ok(tabIds.includes('draft: "materials"'));
    assert.ok(tabIds.includes('inspection: "review"'));
    assert.ok(tabIds.includes("#github-auto-collect"));
  });

  it("supports tab query navigation", () => {
    const editor = readSource("src/components/ProviderPackEditor.tsx");
    assert.ok(editor.includes('params.set("tab"'));
    assert.ok(editor.includes("resolveProviderPackTabFromLocation"));
  });
});

describe("store responsive layout UX sources", () => {
  it("removes fixed mobile shell width", () => {
    const shell = readSource("src/components/MobileShell.tsx");
    const nav = readSource("src/components/BottomTabNav.tsx");
    assert.ok(shell.includes("max-w-[1120px]"));
    assert.ok(nav.includes("max-w-[1120px]"));
    assert.ok(!shell.includes("max-w-[430px]"));
    assert.ok(!nav.includes("max-w-[430px]"));
  });
});
