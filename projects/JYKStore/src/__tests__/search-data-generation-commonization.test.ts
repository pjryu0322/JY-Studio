import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  SEARCH_DATA_FAILURE,
} from "../lib/search-data/search-data-generation-failures.ts";
import {
  SEARCH_DATA_AUDIT_EVENT,
} from "../lib/search-data/search-data-generation-events.ts";

const root = join(process.cwd());
const searchDataDir = join(root, "src/lib/search-data");

describe("Phase 4 search-data generation domain commonization", () => {
  it("keeps failure code literals identical to historical values", () => {
    assert.equal(SEARCH_DATA_FAILURE.PACK_NOT_DRAFT, "PACK_NOT_DRAFT");
    assert.equal(SEARCH_DATA_FAILURE.BINDING_STALE, "SEARCH_DATA_BINDING_STALE");
    assert.equal(SEARCH_DATA_FAILURE.VECTOR_COUNT_MISMATCH, "VECTOR_COUNT_MISMATCH");
    assert.equal(SEARCH_DATA_FAILURE.INDEX_BUILD_FAILED, "INDEX_BUILD_FAILED");
    assert.equal(SEARCH_DATA_FAILURE.RECOVERY_FAILED, "SEARCH_DATA_RECOVERY_FAILED");
    assert.equal(
      SEARCH_DATA_FAILURE.RETRIEVAL_EVALUATION_FAILED,
      "RETRIEVAL_EVALUATION_FAILED",
    );
    assert.equal(SEARCH_DATA_FAILURE.CLEANUP_FAILED, "SEARCH_DATA_CLEANUP_FAILED");
  });

  it("keeps audit event name literals identical", () => {
    assert.equal(
      SEARCH_DATA_AUDIT_EVENT.GENERATION_FORCE_ENQUEUED,
      "SEARCH_DATA_GENERATION_FORCE_ENQUEUED",
    );
    assert.equal(
      SEARCH_DATA_AUDIT_EVENT.GENERATION_STALE_BINDING,
      "SEARCH_DATA_GENERATION_STALE_BINDING",
    );
    assert.equal(
      SEARCH_DATA_AUDIT_EVENT.VALIDATION_FAILED,
      "SEARCH_DATA_VALIDATION_FAILED",
    );
  });

  it("shares artifact cleanup helper between enqueue and recovery", () => {
    const artifacts = readFileSync(
      join(searchDataDir, "search-data-generation-artifacts.ts"),
      "utf8",
    );
    const enqueueTx = readFileSync(
      join(searchDataDir, "search-data-generation-enqueue-tx.ts"),
      "utf8",
    );
    const recover = readFileSync(
      join(searchDataDir, "search-data-generation-worker-recover.ts"),
      "utf8",
    );
    assert.match(artifacts, /export async function deleteSearchDataGenerationArtifactsTx/);
    assert.match(artifacts, /export async function deleteDraftGenerationWithArtifactsTx/);
    assert.match(enqueueTx, /deleteDraftGenerationWithArtifactsTx/);
    assert.match(recover, /deleteSearchDataGenerationArtifactsTx/);
    assert.doesNotMatch(recover, /DELETE FROM "SearchIndexVector"/);
  });

  it("evaluation FAIL/WARNING does not call failDraftIndexGeneration", () => {
    const writes = readFileSync(
      join(searchDataDir, "search-data-generation-evaluation-writes.ts"),
      "utf8",
    );
    const transitions = readFileSync(
      join(searchDataDir, "search-data-generation-transitions.ts"),
      "utf8",
    );
    assert.match(writes, /Keep SearchIndexGeneration INDEXING/);
    assert.doesNotMatch(writes, /failDraftIndexGeneration\s*\(/);
    assert.doesNotMatch(transitions, /failDraftIndexGeneration/);
    assert.doesNotMatch(transitions, /markSearchGenerationFailed/);
  });

  it("transition helpers preserve INDEXING / SEARCH_EVALUATING / READY_FOR_REVIEW", () => {
    const transitions = readFileSync(
      join(searchDataDir, "search-data-generation-transitions.ts"),
      "utf8",
    );
    assert.match(transitions, /step:\s*"INDEXING"/);
    assert.match(transitions, /step:\s*"SEARCH_EVALUATING"/);
    assert.match(transitions, /step:\s*"READY_FOR_REVIEW"/);
    assert.match(transitions, /검색데이터를 생성하는 중/);
    assert.match(transitions, /retrievalRankingPolicyVersion:\s*RETRIEVAL_RANKING_POLICY_VERSION/);
  });

  it("facade remains a thin public re-export surface", () => {
    const facade = readFileSync(
      join(searchDataDir, "search-data-generation-service.ts"),
      "utf8",
    );
    assert.match(facade, /startSearchDataGeneration/);
    assert.match(facade, /validateSearchData/);
    assert.match(facade, /processSearchDataGenerationJob/);
    assert.doesNotMatch(facade, /recordProviderAudit/);
    assert.doesNotMatch(facade, /completePipelineStep/);
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

    // Leaf modules must not import the facade.
    for (const file of files) {
      if (file === "search-data-generation-service.ts") continue;
      const src = readFileSync(join(searchDataDir, file), "utf8");
      assert.doesNotMatch(
        src,
        /from ["']@\/lib\/search-data\/search-data-generation-service["']/,
      );
    }
  });
});
