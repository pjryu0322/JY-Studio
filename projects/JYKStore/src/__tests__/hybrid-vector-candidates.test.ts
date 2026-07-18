import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  MAX_HYBRID_CANDIDATES,
  MAX_FILTERED_CANDIDATES,
  VECTOR_CANDIDATE_MAX,
  VECTOR_CANDIDATE_MIN,
  VECTOR_CANDIDATE_MULTIPLIER,
  resolveVectorCandidateTopK,
} from "@/lib/retrieval/retrieval-config";
import { unionCandidateChunkIds } from "@/lib/retrieval/hybrid-ranking-service";
import { cosineDistanceToSimilarity } from "@/lib/search-vector/search-vector-query";
import { clampedCosineSimilarity } from "@/lib/vector-similarity";

describe("pgvector hybrid candidate policy", () => {
  it("resolves vector Top-K with multiplier/min/max", () => {
    assert.equal(VECTOR_CANDIDATE_MULTIPLIER, 5);
    assert.equal(VECTOR_CANDIDATE_MIN, 20);
    assert.equal(VECTOR_CANDIDATE_MAX, 200);
    assert.equal(resolveVectorCandidateTopK(1), 20);
    assert.equal(resolveVectorCandidateTopK(10), 50);
    assert.equal(resolveVectorCandidateTopK(100), 200);
    assert.equal(MAX_HYBRID_CANDIDATES, MAX_FILTERED_CANDIDATES + VECTOR_CANDIDATE_MAX);
  });

  it("unions keyword and vector candidate ids without duplicates", () => {
    const merged = unionCandidateChunkIds(
      ["k1", "k2", "shared"],
      ["v1", "shared", "v2"],
    );
    assert.deepEqual(merged, ["k1", "k2", "shared", "v1", "v2"]);
    assert.equal(merged.length, 5);
  });

  it("converts pgvector cosine distance with absolute error < 1e-6 vs Node cosine", () => {
    const a = [0.6, 0.8, 0, 0];
    const b = [0.6, 0.8, 0, 0];
    const c = [0.8, -0.6, 0, 0];

    const simIdentical = clampedCosineSimilarity(a, b);
    const distIdentical = 1 - simIdentical;
    assert.ok(Math.abs(cosineDistanceToSimilarity(distIdentical) - simIdentical) < 1e-6);

    const simOrtho = clampedCosineSimilarity(a, c);
    const distOrtho = 1 - simOrtho;
    assert.ok(Math.abs(cosineDistanceToSimilarity(distOrtho) - simOrtho) < 1e-6);

    assert.equal(cosineDistanceToSimilarity(0), 1);
    assert.equal(cosineDistanceToSimilarity(1), 0);
    assert.equal(cosineDistanceToSimilarity(2), 0);
  });

  it("embeds the query only once on the generation hybrid path (source invariant)", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "retrieval", "hybrid-ranking-service.ts"),
      "utf8",
    );
    const embedCalls = source.match(/adapter\.embed\(/g) ?? [];
    assert.equal(embedCalls.length, 1, "generation path must call adapter.embed exactly once");
    assert.match(source, /querySearchIndexVectorsByGeneration/);
    assert.match(source, /requireSearchGeneration|requireGeneration/);
    assert.match(source, /Generation lookup failure is not legacy/);
  });
});
