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
  it("defines five provider pack tabs with inspection before review", () => {
    const tabs = readSource("src/components/ProviderPackTabs.tsx");
    const editor = readSource("src/components/ProviderPackEditor.tsx");
    const tabIds = readSource("src/lib/provider-pack-tabs.ts");
    assert.ok(tabs.includes("PROVIDER_PACK_TAB_BASIC"));
    assert.ok(tabs.includes("PROVIDER_PACK_TAB_SOURCE"));
    assert.ok(tabs.includes("PROVIDER_PACK_TAB_DRAFT"));
    assert.ok(tabs.includes("PROVIDER_PACK_TAB_INSPECTION"));
    assert.ok(tabs.includes("PROVIDER_PACK_TAB_REVIEW"));
    assert.ok(!tabs.includes("PROVIDER_PACK_TAB_PUBLISH"));
    assert.ok(tabIds.includes('"inspection"'));
    assert.ok(tabIds.indexOf('"draft"') < tabIds.indexOf('"inspection"'));
    assert.ok(tabIds.indexOf('"inspection"') < tabIds.indexOf('"review"'));
    assert.ok(editor.includes("ProviderPackTabs"));
    assert.ok(editor.includes("ProviderPackInspectionTab"));
    assert.ok(editor.includes('activeTab === "source"'));
    assert.ok(editor.includes('activeTab === "inspection"'));
    assert.ok(editor.includes('activeTab === "review"'));
  });

  it("keeps quality panels on inspection tab only", () => {
    const inspection = readSource("src/components/ProviderPackInspectionTab.tsx");
    const review = readSource("src/components/ProviderPackReviewTab.tsx");
    const source = readSource("src/components/ProviderPackSourceStep.tsx");
    assert.ok(inspection.includes("StructureQualityPanel"));
    assert.ok(inspection.includes("ChunkQualityPanel"));
    assert.ok(inspection.includes("RetrievalEvaluationPanel"));
    assert.ok(inspection.includes("SubmitReadinessChecklist"));
    assert.ok(!review.includes("StructureQualityPanel"));
    assert.ok(!review.includes("ChunkQualityPanel"));
    assert.ok(!review.includes("RetrievalEvaluationPanel"));
    assert.ok(!review.includes("evaluateProviderStructureQualityApi"));
    assert.ok(!review.includes("evaluateProviderChunkQualityApi"));
    assert.ok(!review.includes("generateProviderRetrievalEvaluationCasesApi"));
    assert.ok(!review.includes("runProviderRetrievalEvaluationApi"));
    assert.ok(review.includes("PROVIDER_PACK_GO_TO_INSPECTION_TAB"));
    assert.ok(review.includes("SubmitRequestAction"));
    assert.ok(!source.includes("StructureQualityPanel"));
  });

  it("uses collapsed github advanced settings by default", () => {
    const panel = readSource("src/components/ProviderGitHubAutoCollectPanel.tsx");
    assert.ok(panel.includes("PROVIDER_GITHUB_ADVANCED_SETTINGS_EXPAND"));
    assert.ok(panel.includes("<details"));
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
