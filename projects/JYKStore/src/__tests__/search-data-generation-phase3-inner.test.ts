import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  isActivelyRunningLockedGeneration,
  isAlreadyCompleteCandidate,
  isCompleteVectorMatch,
  isScaffoldReuseCandidate,
} from "../lib/search-data/search-data-generation-enqueue-tx-policy.ts";
import { isEvaluationNonPass } from "../lib/search-data/search-data-generation-evaluation-runner.ts";
import { isClaimBindingStale } from "../lib/search-data/search-data-generation-process-preconditions.ts";

const root = join(process.cwd());
const searchDataDir = join(root, "src/lib/search-data");

function baseLocked(overrides: Record<string, unknown> = {}) {
  return {
    id: "g1",
    scope: "DRAFT" as const,
    status: "PENDING" as const,
    attempt: 0,
    embeddingProvider: "local-e5",
    embeddingDimension: 384,
    embeddedCount: 0,
    failedCount: 0,
    chunkCount: 10,
    ...overrides,
  };
}

describe("Phase 3 search-data inner complexity helpers", () => {
  it("preserves enqueue tx branch predicates", () => {
    assert.equal(isActivelyRunningLockedGeneration(baseLocked({ attempt: 0 })), false);
    assert.equal(
      isActivelyRunningLockedGeneration(baseLocked({ status: "PENDING", attempt: 1 })),
      true,
    );
    assert.equal(
      isActivelyRunningLockedGeneration(baseLocked({ status: "EMBEDDING", attempt: 1 })),
      true,
    );
    assert.equal(isAlreadyCompleteCandidate(baseLocked({ status: "READY" }), false), true);
    assert.equal(isAlreadyCompleteCandidate(baseLocked({ status: "READY" }), true), false);
    assert.equal(
      isCompleteVectorMatch({
        locked: baseLocked({ status: "READY", embeddedCount: 10, failedCount: 0 }),
        vectorCount: 10,
        chunkCount: 10,
      }),
      true,
    );
    assert.equal(isScaffoldReuseCandidate(baseLocked({ attempt: 0 }), false), true);
    assert.equal(isScaffoldReuseCandidate(baseLocked({ attempt: 0 }), true), false);
  });

  it("keeps evaluation non-pass without treating PASS as failure", () => {
    assert.equal(isEvaluationNonPass("FAIL"), true);
    assert.equal(isEvaluationNonPass("WARNING"), true);
    assert.equal(isEvaluationNonPass("PASS"), false);
  });

  it("detects claim binding stale mismatches", () => {
    const claimed = {
      id: "g1",
      packId: "p1",
      versionId: "v1",
      pipelineRunId: "run1",
      attempt: 1,
      chunkGenerationId: "g1",
      normalizedDocumentId: "nd1",
      fingerprint: "fp1",
      chunkCount: 5,
    };
    assert.equal(
      isClaimBindingStale({
        latestId: "run1",
        binding: {
          indexGenerationId: "g1",
          fingerprint: "fp1",
          normalizedDocumentId: "nd1",
        },
        claimed,
      }),
      false,
    );
    assert.equal(
      isClaimBindingStale({
        latestId: "run2",
        binding: {
          indexGenerationId: "g1",
          fingerprint: "fp1",
          normalizedDocumentId: "nd1",
        },
        claimed,
      }),
      true,
    );
  });

  it("evaluation writes keep INDEXING on FAIL/WARNING (no failDraft)", () => {
    const writes = readFileSync(
      join(searchDataDir, "search-data-generation-evaluation-writes.ts"),
      "utf8",
    );
    assert.match(writes, /Keep SearchIndexGeneration INDEXING/);
    assert.doesNotMatch(writes, /failDraftIndexGeneration\s*\(/);
    assert.doesNotMatch(writes, /import\s*\{[^}]*failDraftIndexGeneration/);
  });

  it("facade still re-exports public orchestration API", () => {
    const facade = readFileSync(
      join(searchDataDir, "search-data-generation-service.ts"),
      "utf8",
    );
    for (const name of [
      "provisionalEnqueueLocalE5Descriptor",
      "searchDataStaleSeconds",
      "startSearchDataGeneration",
      "getSearchDataStatus",
      "recoverOneStaleSearchDataGeneration",
      "claimNextSearchDataGeneration",
      "processSearchDataGenerationJob",
      "validateSearchData",
      "__testOnlyIsLocalE5Generation",
    ]) {
      assert.match(facade, new RegExp(name));
    }
  });

  it("avoids circular imports among search-data-generation modules", () => {
    const files = readdirSync(searchDataDir).filter(
      (f) => f.startsWith("search-data-generation") && f.endsWith(".ts"),
    );
    const importRe =
      /from\s+["']@\/lib\/search-data\/(search-data-generation-[a-z0-9-]+)["']/g;
    const graph = new Map<string, string[]>();
    for (const file of files) {
      const src = readFileSync(join(searchDataDir, file), "utf8");
      const deps: string[] = [];
      for (const match of src.matchAll(importRe)) {
        deps.push(`${match[1]}.ts`);
      }
      graph.set(file, deps);
    }

    const visiting = new Set<string>();
    const visited = new Set<string>();
    function visit(node: string, stack: string[]) {
      if (visiting.has(node)) {
        assert.fail(`circular import: ${[...stack, node].join(" -> ")}`);
      }
      if (visited.has(node)) return;
      visiting.add(node);
      for (const dep of graph.get(node) ?? []) {
        if (graph.has(dep)) visit(dep, [...stack, node]);
      }
      visiting.delete(node);
      visited.add(node);
    }
    for (const file of files) visit(file, []);
  });
});
