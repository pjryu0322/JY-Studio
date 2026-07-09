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
  it("renders wizard source step before pre-review checks in editor", () => {
    const editor = readSource("src/components/ProviderPackEditor.tsx");
    const sourceIdx = editor.indexOf("ProviderPackSourceStep");
    const checksIdx = editor.indexOf("PROVIDER_PACK_PRE_REVIEW_CHECKS_SUMMARY");
    assert.ok(sourceIdx >= 0);
    assert.ok(checksIdx >= 0);
    assert.ok(sourceIdx < checksIdx);
    assert.ok(editor.includes("ProviderPackWizardStepper"));
    assert.ok(editor.includes("PROVIDER_PACK_BASIC_INFO_SUMMARY"));
    assert.ok(editor.includes("<details"));
  });

  it("hides technical github options behind advanced settings", () => {
    const panel = readSource("src/components/ProviderGitHubAutoCollectPanel.tsx");
    assert.ok(panel.includes("PROVIDER_GITHUB_ADVANCED_SETTINGS"));
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
