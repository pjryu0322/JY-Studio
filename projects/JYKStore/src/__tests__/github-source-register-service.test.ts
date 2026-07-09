import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GitHubDiscoveryError } from "@/lib/github-auto-collect/github-auto-collect-types";
import { normalizeGitHubSourceRegisterInput } from "@/lib/github-auto-collect/github-source-register-options";
import { registerGitHubSourceDocumentsForPack } from "@/lib/github-auto-collect/github-source-register-service";
import type { CreateSourceDocumentInput } from "@/lib/provider-pack-service";

function blobTree(paths: Array<{ path: string; sha: string; size: number }>) {
  return {
    sha: "tree",
    truncated: false,
    tree: paths.map((p) => ({
      path: p.path,
      mode: "100644",
      type: "blob" as const,
      sha: p.sha,
      size: p.size,
    })),
  };
}

function githubFetchFactory(blobs: Record<string, string>) {
  return async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/repos/test/repo") && !url.includes("/git/")) {
      return new Response(
        JSON.stringify({
          name: "repo",
          full_name: "test/repo",
          html_url: "https://github.com/test/repo",
          default_branch: "main",
          private: false,
          archived: false,
          license: { spdx_id: "MIT", name: "MIT" },
          size: 1,
          language: "TypeScript",
          description: "UI grid component",
        }),
        { status: 200 },
      );
    }
    if (url.includes("/git/trees/")) {
      return new Response(
        JSON.stringify(
          blobTree([
            { path: "README.md", sha: "sha-readme", size: 100 },
            { path: "docs/getting-started.md", sha: "sha-gs", size: 200 },
            { path: "examples/basic.ts", sha: "sha-ex", size: 300 },
            { path: "src/index.ts", sha: "sha-src", size: 400 },
          ]),
        ),
        { status: 200 },
      );
    }
    if (url.includes("/git/blobs/")) {
      const sha = url.split("/").pop() ?? "";
      const text = blobs[sha] ?? "";
      const encoded = Buffer.from(text, "utf8").toString("base64");
      return new Response(
        JSON.stringify({ content: encoded, encoding: "base64", size: text.length }),
        { status: 200 },
      );
    }
    return new Response("not found", { status: 404 });
  };
}

describe("github source register service", () => {
  it("requires selectedSourcePaths", () => {
    assert.throws(
      () =>
        normalizeGitHubSourceRegisterInput(
          { repositoryUrl: "https://github.com/test/repo", selectedSourcePaths: [] },
          [],
        ),
      (err: unknown) =>
        err instanceof GitHubDiscoveryError && err.code === "INVALID_SOURCE_REGISTER_OPTIONS",
    );
  });

  it("registers README and maps types/formats", async () => {
    const created: CreateSourceDocumentInput[] = [];
    const fetchImpl = githubFetchFactory({
      "sha-readme": "# Title\n\nBody content for readme file.",
      "sha-gs": "# Getting Started\n\nSteps here.",
      "sha-ex": "export const demo = 1;",
    });

    const result = await registerGitHubSourceDocumentsForPack(
      "client-1",
      "pack-1",
      {
        repositoryUrl: "https://github.com/test/repo",
        selectedSourcePaths: ["README.md", "docs/getting-started.md", "examples/basic.ts"],
        sourceCodeAnalysis: "NONE",
      },
      {
        fetchImpl: fetchImpl as typeof fetch,
        createSourceDocument: async (_clientId, _packId, input) => {
          created.push(input);
          return { pack: { packId: "pack-1", versions: [] } as never };
        },
      },
    );

    assert.equal(result.summary.registeredCount, 3);
    assert.equal(created[0]?.sourceType, "PRODUCT_MANUAL");
    assert.equal(created[0]?.sourceFormat, "MARKDOWN");
    assert.equal(created[1]?.sourceType, "INTEGRATION_GUIDE");
    assert.equal(created[2]?.sourceType, "SAMPLE_CODE");
    assert.equal(created[2]?.sourceFormat, "CODE");
  });

  it("skips SRC when content fetch disabled and enforces fetch limits", async () => {
    const fetchImpl = githubFetchFactory({
      "sha-readme": "# Readme",
      "sha-src": "export {}",
      "sha-gs": "# GS",
    });
    let blobCalls = 0;
    const wrappedFetch = async (input: RequestInfo | URL) => {
      if (String(input).includes("/git/blobs/")) blobCalls += 1;
      return fetchImpl(input);
    };

    const result = await registerGitHubSourceDocumentsForPack(
      "client-1",
      "pack-1",
      {
        repositoryUrl: "https://github.com/test/repo",
        selectedSourcePaths: ["README.md", "src/index.ts", "docs/getting-started.md"],
        sourceCodeAnalysis: "METADATA_ONLY",
        maxFilesToFetch: 1,
      },
      {
        fetchImpl: wrappedFetch as typeof fetch,
        createSourceDocument: async () => ({ pack: { packId: "pack-1" } as never }),
      },
    );

    assert.ok(result.skippedFiles.some((s) => s.path === "src/index.ts" && s.reason === "CONTENT_FETCH_DISABLED"));
    assert.ok(
      result.skippedFiles.some((s) => s.reason === "MAX_FILES_TO_FETCH_EXCEEDED"),
    );
    assert.equal(blobCalls, 1);
  });

  it("dedupes duplicate selected paths with warning", async () => {
    const result = await registerGitHubSourceDocumentsForPack(
      "client-1",
      "pack-1",
      {
        repositoryUrl: "https://github.com/test/repo",
        selectedSourcePaths: ["README.md", "README.md"],
        sourceCodeAnalysis: "NONE",
      },
      {
        fetchImpl: githubFetchFactory({ "sha-readme": "# Hi" }) as typeof fetch,
        createSourceDocument: async () => ({ pack: { packId: "pack-1" } as never }),
      },
    );
    assert.ok(result.warnings.some((w) => w.includes("중복")));
    assert.equal(result.summary.selectedPathCount, 1);
  });

  it("accumulates failed files and continues", async () => {
    const result = await registerGitHubSourceDocumentsForPack(
      "client-1",
      "pack-1",
      {
        repositoryUrl: "https://github.com/test/repo",
        selectedSourcePaths: ["README.md", "docs/getting-started.md"],
        sourceCodeAnalysis: "NONE",
      },
      {
        fetchImpl: githubFetchFactory({
          "sha-readme": "# ok",
          "sha-gs": "# gs",
        }) as typeof fetch,
        createSourceDocument: async (_c, _p, input) => {
          if (input.title === "docs/getting-started") {
            return { error: "VALIDATION" as const, message: "duplicate checksum" };
          }
          return { pack: { packId: "pack-1", versions: [] } as never };
        },
      },
    );

    assert.equal(result.summary.registeredCount, 1);
    assert.equal(result.summary.failedCount, 1);
    assert.ok(result.failedFiles.some((f) => f.path === "docs/getting-started.md"));
  });
});
