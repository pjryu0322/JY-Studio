import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GitHubDiscoveryError } from "@/lib/github-auto-collect/github-auto-collect-types";
import { parseGitHubRepositoryUrl } from "@/lib/github-auto-collect/github-url";

describe("github url parser", () => {
  it("parses canonical repository URL", () => {
    const parsed = parseGitHubRepositoryUrl("https://github.com/nhn/tui.grid");
    assert.equal(parsed.owner, "nhn");
    assert.equal(parsed.repo, "tui.grid");
    assert.equal(parsed.normalizedRepositoryUrl, "https://github.com/nhn/tui.grid");
  });

  it("strips .git suffix and trailing slash", () => {
    const parsed = parseGitHubRepositoryUrl("https://github.com/nhn/tui.grid.git/");
    assert.equal(parsed.repo, "tui.grid");
  });

  it("normalizes tree and blob URLs to repository", () => {
    const tree = parseGitHubRepositoryUrl(
      "https://github.com/nhn/tui.grid/tree/master/packages/foo",
    );
    assert.equal(tree.owner, "nhn");
    assert.equal(tree.repo, "tui.grid");
    assert.equal(tree.ref, "master");
    assert.equal(tree.path, "packages/foo");

    const blob = parseGitHubRepositoryUrl(
      "https://github.com/nhn/tui.grid/blob/main/README.md",
    );
    assert.equal(blob.ref, "main");
    assert.equal(blob.path, "README.md");
  });

  it("rejects non-github domains", () => {
    assert.throws(
      () => parseGitHubRepositoryUrl("https://example.com/test/repo"),
      (err: unknown) =>
        err instanceof GitHubDiscoveryError && err.code === "INVALID_GITHUB_URL",
    );
  });

  it("rejects ssh URLs", () => {
    assert.throws(
      () => parseGitHubRepositoryUrl("git@github.com:nhn/tui.grid.git"),
      (err: unknown) =>
        err instanceof GitHubDiscoveryError && err.code === "INVALID_GITHUB_URL",
    );
  });
});
