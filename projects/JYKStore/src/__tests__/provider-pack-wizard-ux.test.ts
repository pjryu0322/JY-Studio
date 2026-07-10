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
  it("renders wizard source step before inspection and review in editor", () => {
    const editor = readSource("src/components/ProviderPackEditor.tsx");
    const sourceIdx = editor.indexOf('activeTab === "source"');
    const inspectionIdx = editor.indexOf('activeTab === "inspection"');
    const reviewIdx = editor.indexOf('activeTab === "review"');
    assert.ok(sourceIdx >= 0);
    assert.ok(inspectionIdx >= 0);
    assert.ok(reviewIdx >= 0);
    assert.ok(sourceIdx < inspectionIdx);
    assert.ok(inspectionIdx < reviewIdx);
    assert.ok(editor.includes("ProviderPackTabs"));
    assert.ok(editor.includes("ProviderPackBasicInfoTab"));
    assert.ok(editor.includes("ProviderPackInspectionTab"));
    assert.ok(editor.includes("ProviderPackReviewTab"));
  });

  it("hides technical github options behind advanced settings", () => {
    const panel = readSource("src/components/ProviderGitHubAutoCollectPanel.tsx");
    assert.ok(panel.includes("PROVIDER_GITHUB_ADVANCED_SETTINGS_EXPAND"));
    assert.ok(!panel.includes(">crawlMode<"));
    assert.ok(!panel.includes(">sourceCodeAnalysis<"));
    assert.ok(!panel.includes(">maxCandidateFiles<"));
    assert.ok(!panel.includes(">maxFilesToFetch<"));
  });

  it("separates github and manual source registration", () => {
    const sourceStep = readSource("src/components/ProviderPackSourceStep.tsx");
    assert.ok(sourceStep.includes("PROVIDER_PACK_SOURCE_METHOD_GITHUB"));
    assert.ok(sourceStep.includes("PROVIDER_PACK_SOURCE_METHOD_MANUAL"));
    assert.ok(sourceStep.includes("wizardMode"));
    assert.ok(!sourceStep.includes("ProviderSourceDocumentForm") || sourceStep.includes('method === "manual"'));
  });
});
