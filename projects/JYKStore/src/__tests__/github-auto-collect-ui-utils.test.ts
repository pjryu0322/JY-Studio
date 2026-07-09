import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GitHubDiscoverySourceCandidate } from "@/lib/github-auto-collect/github-auto-collect-types";
import {
  selectDefaultGitHubSourceCandidatePaths,
  summarizeExcludedFilesByReason,
} from "@/lib/github-auto-collect/github-auto-collect-ui-utils";

function candidate(
  partial: Partial<GitHubDiscoverySourceCandidate> & Pick<GitHubDiscoverySourceCandidate, "path" | "fileClass">,
): GitHubDiscoverySourceCandidate {
  return {
    type: "blob",
    size: 100,
    score: partial.score ?? 50,
    reasonCodes: [],
    sourceTypeSuggestion: "ETC",
    shouldFetchContent: partial.shouldFetchContent ?? true,
    ...partial,
  };
}

describe("github auto collect ui utils", () => {
  it("selects fetchable allowlisted candidates by score with limit", () => {
    const paths = selectDefaultGitHubSourceCandidatePaths(
      [
        candidate({ path: "README.md", fileClass: "README", score: 100 }),
        candidate({ path: "docs/guide.md", fileClass: "DOCS", score: 80 }),
        candidate({ path: "src/index.ts", fileClass: "SRC", score: 99, shouldFetchContent: true }),
        candidate({ path: "test/a.spec.ts", fileClass: "TEST", score: 90, shouldFetchContent: false }),
        candidate({ path: "examples/basic.ts", fileClass: "EXAMPLE", score: 70 }),
      ],
      2,
    );
    assert.deepEqual(paths, ["README.md", "docs/guide.md"]);
  });

  it("summarizes excluded files by reason", () => {
    const summary = summarizeExcludedFilesByReason([
      { excludeReason: "TEST" },
      { excludeReason: "TEST" },
      { excludeReason: "BINARY" },
    ]);
    assert.deepEqual(summary, [
      { reason: "TEST", count: 2 },
      { reason: "BINARY", count: 1 },
    ]);
  });
});
