import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCandidateAndExcluded,
  scoreGitHubFile,
} from "@/lib/github-auto-collect/github-crawl-policy";
import type { GitHubTreeFileItem } from "@/lib/github-auto-collect/github-auto-collect-types";

function blob(path: string, size = 100): GitHubTreeFileItem {
  return { path, type: "blob", size };
}

describe("github crawl policy", () => {
  it("scores root README highest", () => {
    const { score, reasonCodes } = scoreGitHubFile("README.md", "README");
    assert.ok(score >= 100);
    assert.ok(reasonCodes.includes("ROOT_README"));
  });

  it("excludes src when sourceCodeAnalysis is NONE", () => {
    const { sourceCandidates, excludedFiles } = buildCandidateAndExcluded({
      files: [blob("README.md", 12000), blob("src/index.ts", 3000)],
      crawlMode: "FULL_REPO_SCAN",
      sourceCodeAnalysis: "NONE",
      maxCandidateFiles: 100,
    });
    assert.ok(sourceCandidates.some((c) => c.path === "README.md"));
    assert.ok(
      excludedFiles.some(
        (e) =>
          e.path === "src/index.ts" && e.excludeReason === "SOURCE_CODE_ANALYSIS_DISABLED",
      ),
    );
  });

  it("includes src metadata-only candidates without content fetch", () => {
    const { sourceCandidates } = buildCandidateAndExcluded({
      files: [blob("src/main/App.java", 500)],
      crawlMode: "FULL_REPO_SCAN",
      sourceCodeAnalysis: "METADATA_ONLY",
      maxCandidateFiles: 100,
    });
    const src = sourceCandidates.find((c) => c.path === "src/main/App.java");
    assert.ok(src);
    assert.equal(src.shouldFetchContent, false);
    assert.ok(src.reasonCodes.includes("METADATA_ONLY"));
  });
});
