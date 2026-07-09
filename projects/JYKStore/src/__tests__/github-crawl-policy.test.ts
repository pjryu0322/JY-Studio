import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCandidateAndExcluded,
  compareDiscoveryCandidates,
  isSrcEntrypoint,
  scoreGitHubFile,
  suggestSourceType,
} from "@/lib/github-auto-collect/github-crawl-policy";
import { normalizeDiscoveryOptions } from "@/lib/github-auto-collect/github-discovery-options";
import type { GitHubTreeFileItem } from "@/lib/github-auto-collect/github-auto-collect-types";
import { GitHubDiscoveryError } from "@/lib/github-auto-collect/github-auto-collect-types";

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

  it("filters files outside selectedPaths", () => {
    const { sourceCandidates, excludedFiles } = buildCandidateAndExcluded({
      files: [
        blob("README.md"),
        blob("docs/guide.md"),
        blob("src/index.ts"),
      ],
      crawlMode: "FULL_REPO_SCAN",
      sourceCodeAnalysis: "NONE",
      maxCandidateFiles: 100,
      selectedPaths: ["README.md"],
    });
    assert.ok(sourceCandidates.some((c) => c.path === "README.md"));
    assert.ok(
      excludedFiles.some(
        (e) => e.path === "docs/guide.md" && e.excludeReason === "SELECTED_PATHS_FILTER",
      ),
    );
    assert.ok(
      excludedFiles.some(
        (e) => e.path === "src/index.ts" && e.excludeReason === "SELECTED_PATHS_FILTER",
      ),
    );
  });

  it("includes docs subtree when selectedPaths is docs", () => {
    const { sourceCandidates } = buildCandidateAndExcluded({
      files: [blob("docs/ko/getting-started.md"), blob("src/index.ts")],
      crawlMode: "FULL_REPO_SCAN",
      sourceCodeAnalysis: "NONE",
      maxCandidateFiles: 100,
      selectedPaths: ["docs"],
    });
    assert.ok(sourceCandidates.some((c) => c.path === "docs/ko/getting-started.md"));
  });

  it("ENTRYPOINTS_ONLY keeps src entrypoints only", () => {
    const { sourceCandidates, excludedFiles } = buildCandidateAndExcluded({
      files: [blob("src/index.ts"), blob("src/internal/helper.ts")],
      crawlMode: "FULL_REPO_SCAN",
      sourceCodeAnalysis: "ENTRYPOINTS_ONLY",
      maxCandidateFiles: 100,
    });
    assert.ok(sourceCandidates.some((c) => c.path === "src/index.ts"));
    assert.ok(
      excludedFiles.some(
        (e) =>
          e.path === "src/internal/helper.ts" &&
          e.excludeReason === "SOURCE_CODE_ENTRYPOINTS_ONLY",
      ),
    );
    assert.ok(isSrcEntrypoint("src/index.ts"));
    assert.equal(isSrcEntrypoint("src/internal/helper.ts"), false);
  });

  it("maps sourceTypeSuggestion to Prisma SourceType", () => {
    assert.equal(suggestSourceType("README", "README.md"), "PRODUCT_MANUAL");
    assert.equal(suggestSourceType("DOCS", "docs/guide.md"), "PRODUCT_MANUAL");
    assert.equal(suggestSourceType("GETTING_STARTED", "getting-started.md"), "INTEGRATION_GUIDE");
    assert.equal(suggestSourceType("EXAMPLE", "examples/basic.ts"), "SAMPLE_CODE");
    assert.equal(suggestSourceType("API_DOC", "openapi.yaml"), "OPENAPI_SCHEMA");
    assert.equal(suggestSourceType("PACKAGE_MANIFEST", "package.json"), "ETC");
  });

  it("scores documentation types with expected ordering", () => {
    const rootReadme = scoreGitHubFile("README.md", "README", 1000);
    const gettingStarted = scoreGitHubFile("docs/getting-started.md", "GETTING_STARTED", 1000);
    const apiDoc = scoreGitHubFile("docs/api.md", "API_DOC", 1000);
    const docs = scoreGitHubFile("docs/guide.md", "DOCS", 1000);
    assert.ok(rootReadme.score > docs.score);
    assert.ok(gettingStarted.score > docs.score);
    assert.ok(apiDoc.score > docs.score);
  });

  it("scores basic example above generic example and penalizes stories", () => {
    const basic = scoreGitHubFile("examples/basic/index.ts", "EXAMPLE", 1000);
    const generic = scoreGitHubFile("examples/other/app.ts", "EXAMPLE", 1000);
    const story = scoreGitHubFile("stories/Grid.stories.tsx", "EXAMPLE", 1000);
    assert.ok(basic.score > generic.score);
    assert.ok(story.score < generic.score);
    assert.ok(story.reasonCodes.includes("STORYBOOK_EXAMPLE"));
  });

  it("penalizes large and deprecated paths", () => {
    const large = scoreGitHubFile("docs/guide.md", "DOCS", 600 * 1024);
    const small = scoreGitHubFile("docs/guide.md", "DOCS", 1000);
    assert.ok(large.score < small.score);
    const deprecated = scoreGitHubFile("docs/deprecated/old.md", "DOCS", 1000);
    assert.ok(deprecated.reasonCodes.includes("DEPRECATED_PENALTY"));
  });

  it("sorts candidates by score, file class, then path", () => {
    const { sourceCandidates } = buildCandidateAndExcluded({
      files: [
        blob("package.json"),
        blob("docs/guide.md"),
        blob("docs/api.md"),
        blob("docs/getting-started.md"),
        blob("examples/basic/index.ts"),
        blob("README.md"),
      ],
      crawlMode: "FULL_REPO_SCAN",
      sourceCodeAnalysis: "NONE",
      maxCandidateFiles: 100,
    });
    const paths = sourceCandidates.map((c) => c.path);
    const readmeIdx = paths.indexOf("README.md");
    const gsIdx = paths.indexOf("docs/getting-started.md");
    const apiIdx = paths.indexOf("docs/api.md");
    const guideIdx = paths.indexOf("docs/guide.md");
    const exIdx = paths.indexOf("examples/basic/index.ts");
    const pkgIdx = paths.indexOf("package.json");
    assert.ok(readmeIdx < gsIdx);
    assert.ok(gsIdx < apiIdx);
    assert.ok(apiIdx < guideIdx);
    assert.ok(guideIdx < exIdx);
    assert.ok(exIdx < pkgIdx);
    const sorted = [...sourceCandidates].sort(compareDiscoveryCandidates);
    assert.deepEqual(paths, sorted.map((c) => c.path));
  });
});

describe("github discovery options clamp", () => {
  it("accepts valid enum values", () => {
    const warnings: string[] = [];
    const options = normalizeDiscoveryOptions(
      {
        repositoryUrl: "https://github.com/nhn/tui.grid",
        crawlMode: "DOCS_AND_EXAMPLES",
        sourceCodeAnalysis: "ENTRYPOINTS_ONLY",
      },
      warnings,
    );
    assert.equal(options.crawlMode, "DOCS_AND_EXAMPLES");
    assert.equal(options.sourceCodeAnalysis, "ENTRYPOINTS_ONLY");
  });

  it("clamps maxFilesToAnalyze and maxCandidateFiles with warnings", () => {
    const warnings: string[] = [];
    const options = normalizeDiscoveryOptions(
      {
        repositoryUrl: "https://github.com/o/r",
        maxFilesToAnalyze: 999_999,
        maxCandidateFiles: -1,
      },
      warnings,
    );
    assert.equal(options.maxFilesToAnalyze, 10000);
    assert.equal(options.maxCandidateFiles, 10);
    assert.ok(warnings.some((w) => w.includes("maxFilesToAnalyze")));
    assert.ok(warnings.some((w) => w.includes("maxCandidateFiles")));
  });

  it("clamps low values to minimum", () => {
    const warnings: string[] = [];
    const options = normalizeDiscoveryOptions(
      {
        repositoryUrl: "https://github.com/o/r",
        maxFilesToAnalyze: 0,
        maxCandidateFiles: 0,
      },
      warnings,
    );
    assert.equal(options.maxFilesToAnalyze, 100);
    assert.equal(options.maxCandidateFiles, 10);
  });

  it("rejects invalid crawlMode", () => {
    assert.throws(
      () =>
        normalizeDiscoveryOptions(
          {
            repositoryUrl: "https://github.com/nhn/tui.grid",
            crawlMode: "INVALID_MODE" as never,
          },
          [],
        ),
      (err: unknown) =>
        err instanceof GitHubDiscoveryError &&
        err.code === "INVALID_DISCOVERY_OPTIONS" &&
        err.status === 400,
    );
  });

  it("rejects invalid sourceCodeAnalysis", () => {
    assert.throws(
      () =>
        normalizeDiscoveryOptions(
          {
            repositoryUrl: "https://github.com/nhn/tui.grid",
            sourceCodeAnalysis: "BAD_VALUE" as never,
          },
          [],
        ),
      (err: unknown) =>
        err instanceof GitHubDiscoveryError &&
        err.code === "INVALID_DISCOVERY_OPTIONS" &&
        err.status === 400,
    );
  });

  it("rejects non-string option values", () => {
    assert.throws(
      () =>
        normalizeDiscoveryOptions(
          {
            repositoryUrl: "https://github.com/nhn/tui.grid",
            crawlMode: 123 as never,
          },
          [],
        ),
      (err: unknown) => err instanceof GitHubDiscoveryError && err.code === "INVALID_DISCOVERY_OPTIONS",
    );
    assert.throws(
      () =>
        normalizeDiscoveryOptions(
          {
            repositoryUrl: "https://github.com/nhn/tui.grid",
            sourceCodeAnalysis: {} as never,
          },
          [],
        ),
      (err: unknown) => err instanceof GitHubDiscoveryError && err.code === "INVALID_DISCOVERY_OPTIONS",
    );
  });
});
