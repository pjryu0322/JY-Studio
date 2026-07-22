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

describe("provider pack wizard UX sources", () => {
  it("renders 5-step tabs basic → payload → knowledge → serviceValidation → distributionReview", () => {
    const editor = readSource("src/components/ProviderPackEditor.tsx");
    const basicIdx = editor.indexOf('activeTab === "basic"');
    const payloadIdx = editor.indexOf('activeTab === "payload"');
    const knowledgeIdx = editor.indexOf('activeTab === "knowledge"');
    const searchIdx = editor.indexOf('activeTab === "serviceValidation"');
    const distributionReviewIdx = editor.indexOf('activeTab === "distributionReview"');
    assert.ok(basicIdx >= 0);
    assert.ok(payloadIdx >= 0);
    assert.ok(knowledgeIdx >= 0);
    assert.ok(searchIdx >= 0);
    assert.ok(distributionReviewIdx >= 0);
    assert.ok(basicIdx < payloadIdx);
    assert.ok(payloadIdx < knowledgeIdx);
    assert.ok(knowledgeIdx < searchIdx);
    assert.ok(searchIdx < distributionReviewIdx);
    assert.ok(!editor.includes("ProviderPackTabs"));
    assert.ok(editor.includes("RoleWorkspaceShell"));
    assert.ok(editor.includes("getProviderPackRailState"));
    assert.ok(editor.includes("ProviderPackBasicInfoTab"));
    assert.ok(editor.includes("ProviderPayloadTab"));
    assert.ok(editor.includes("ProviderKnowledgeGenerationTab"));
    assert.ok(editor.includes("ProviderServiceValidationTab"));
    assert.ok(editor.includes("ProviderDistributionTab"));
    assert.ok(editor.includes("ProviderPackReviewTab"));
    assert.ok(!editor.includes("ProviderPackInspectionTab"));
    assert.ok(!editor.includes('activeTab === "source"'));
    assert.ok(!editor.includes('activeTab === "inspection"'));
  });

  it("does not mount legacy github auto-collect builder UI", () => {
    const editor = readSource("src/components/ProviderPackEditor.tsx");
    assert.ok(!editor.includes("ProviderGitHubAutoCollectPanel"));
    assert.ok(!editor.includes("ProviderPackSourceStep"));
    assert.ok(!editor.includes("ProviderPackDraftTab"));
  });

  it("materials tab component remains as legacy read-only helper", () => {
    const materials = readSource("src/components/ProviderPackMaterialsTab.tsx");
    assert.ok(materials.includes("PROVIDER_PACK_MATERIALS_TITLE"));
    assert.ok(materials.includes("PROVIDER_PACK_MATERIALS_HINT"));
    assert.ok(materials.includes("PROVIDER_PACK_MATERIALS_REVIEW_VERSION_LABEL"));
    assert.ok(materials.includes("pack.versions[0]"));
    assert.ok(!materials.includes("flatMap"));
    assert.ok(!materials.includes("ProviderGitHubAutoCollectPanel"));
    assert.ok(!materials.includes("ProviderSourceDocumentForm"));
  });
});
