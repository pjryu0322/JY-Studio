import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { discoverGitHubRepository } from "@/lib/github-auto-collect/github-repository-discovery-service";

describe("github repository discovery service", () => {
  it("returns preview from mocked GitHub API", async () => {
    const fetchImpl = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/repos/nhn/tui.grid") && !url.includes("/git/trees")) {
        return new Response(
          JSON.stringify({
            name: "tui.grid",
            full_name: "nhn/tui.grid",
            html_url: "https://github.com/nhn/tui.grid",
            default_branch: "master",
            private: false,
            archived: false,
            license: { spdx_id: "MIT", name: "MIT License" },
            size: 1000,
            language: "JavaScript",
            description: "Grid",
          }),
          { status: 200 },
        );
      }
      if (url.includes("/git/trees/")) {
        return new Response(
          JSON.stringify({
            sha: "abc",
            truncated: false,
            tree: [
              { path: "README.md", mode: "100644", type: "blob", sha: "1", size: 12000 },
              { path: "src", mode: "040000", type: "tree", sha: "2" },
              {
                path: "src/index.ts",
                mode: "100644",
                type: "blob",
                sha: "3",
                size: 3000,
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response("not found", { status: 404 });
    };

    const result = await discoverGitHubRepository(
      {
        repositoryUrl: "https://github.com/nhn/tui.grid",
        sourceCodeAnalysis: "NONE",
      },
      { fetchImpl: fetchImpl as typeof fetch },
    );

    assert.equal(result.repository.fullName, "nhn/tui.grid");
    assert.equal(result.repository.defaultBranch, "master");
    assert.ok(result.sourceCandidates.some((c) => c.path === "README.md"));
    assert.ok(
      result.excludedFiles.some(
        (e) =>
          e.path === "src/index.ts" && e.excludeReason === "SOURCE_CODE_ANALYSIS_DISABLED",
      ),
    );
    assert.ok(result.warnings.some((w) => w.includes("P26.1")));
    assert.equal(JSON.stringify(result).includes("Bearer"), false);
  });
});
