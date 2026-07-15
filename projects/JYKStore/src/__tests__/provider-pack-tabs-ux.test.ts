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
  it("defines six provider pack tabs including service validation", () => {
    const tabs = readSource("src/components/ProviderPackTabs.tsx");
    const editor = readSource("src/components/ProviderPackEditor.tsx");
    const tabIds = readSource("src/lib/provider-pack-tabs.ts");
    assert.ok(tabs.includes("PROVIDER_PACK_TAB_BASIC"));
    assert.ok(tabs.includes("PROVIDER_PACK_TAB_PAYLOAD"));
    assert.ok(tabs.includes("PROVIDER_PACK_TAB_KNOWLEDGE"));
    assert.ok(tabs.includes("PROVIDER_PACK_TAB_DISTRIBUTION"));
    assert.ok(tabs.includes("PROVIDER_PACK_TAB_SERVICE_VALIDATION"));
    assert.ok(tabs.includes("PROVIDER_PACK_TAB_REVIEW"));
    assert.ok(!tabs.includes("PROVIDER_PACK_TAB_SOURCE"));
    assert.ok(!tabs.includes("PROVIDER_PACK_TAB_DRAFT"));
    assert.ok(!tabs.includes("PROVIDER_PACK_TAB_INSPECTION"));
    assert.ok(!tabs.includes("PROVIDER_PACK_TAB_PUBLISH"));
    assert.ok(tabIds.includes('"basic"'));
    assert.ok(tabIds.includes('"payload"'));
    assert.ok(tabIds.includes('"knowledge"'));
    assert.ok(tabIds.includes('"distribution"'));
    assert.ok(tabIds.includes('"serviceValidation"'));
    assert.ok(tabIds.includes('"review"'));
    assert.ok(tabIds.indexOf('"basic"') < tabIds.indexOf('"payload"'));
    assert.ok(tabIds.indexOf('"payload"') < tabIds.indexOf('"knowledge"'));
    assert.ok(tabIds.indexOf('"knowledge"') < tabIds.indexOf('"distribution"'));
    assert.ok(tabIds.indexOf('"distribution"') < tabIds.indexOf('"serviceValidation"'));
    assert.ok(tabIds.indexOf('"serviceValidation"') < tabIds.indexOf('"review"'));
    assert.ok(editor.includes("ProviderPackTabs"));
    assert.ok(editor.includes("ProviderPayloadTab"));
    assert.ok(editor.includes("ProviderKnowledgeGenerationTab"));
    assert.ok(editor.includes("ProviderDistributionTab"));
    assert.ok(editor.includes("ProviderServiceValidationTab"));
    assert.ok(editor.includes("ProviderPackReviewTab"));
    assert.ok(!editor.includes("ProviderPackInspectionTab"));
    assert.ok(!editor.includes("ProviderPackSourceStep"));
    assert.ok(!editor.includes("ProviderGitHubAutoCollectPanel"));
    assert.ok(editor.includes('activeTab === "basic"'));
    assert.ok(editor.includes('activeTab === "payload"'));
    assert.ok(editor.includes('activeTab === "distribution"'));
    assert.ok(editor.includes('activeTab === "serviceValidation"'));
    assert.ok(editor.includes('activeTab === "review"'));
    // Tabs stay mounted (hidden) so Docling selection/upload survives switches.
    assert.ok(editor.includes(': "hidden"'));
    assert.ok(editor.includes("cachedDoclingBundle"));
  });

  it("keeps review tab free of Builder generation panels", () => {
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

  it("redirects legacy builder tab queries to payload/review", () => {
    const tabIds = readSource("src/lib/provider-pack-tabs.ts");
    assert.ok(tabIds.includes("LEGACY_PROVIDER_PACK_TAB_REDIRECT"));
    assert.ok(tabIds.includes('materials: "payload"'));
    assert.ok(tabIds.includes('source: "payload"'));
    assert.ok(tabIds.includes('draft: "payload"'));
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
