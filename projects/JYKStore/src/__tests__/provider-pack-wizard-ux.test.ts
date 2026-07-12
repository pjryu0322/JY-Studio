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
  it("renders freeze-era tabs basic → materials → review in editor", () => {
    const editor = readSource("src/components/ProviderPackEditor.tsx");
    const basicIdx = editor.indexOf('activeTab === "basic"');
    const materialsIdx = editor.indexOf('activeTab === "materials"');
    const reviewIdx = editor.indexOf('activeTab === "review"');
    assert.ok(basicIdx >= 0);
    assert.ok(materialsIdx >= 0);
    assert.ok(reviewIdx >= 0);
    assert.ok(basicIdx < materialsIdx);
    assert.ok(materialsIdx < reviewIdx);
    assert.ok(editor.includes("ProviderPackTabs"));
    assert.ok(editor.includes("ProviderPackBasicInfoTab"));
    assert.ok(editor.includes("ProviderPackMaterialsTab"));
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

  it("materials tab is read-only confirmation of latest-version sources", () => {
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
