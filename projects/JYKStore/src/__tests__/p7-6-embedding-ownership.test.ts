/**
 * P7.6 guard suite — embedding ownership split.
 *
 * Enforces:
 *  - TS document/chunk embedding GENERATION is removed (no `rebuildPackEmbeddings`).
 *  - The ZIP Worker import path NEVER re-embeds Worker output (no `.embedBatch(`,
 *    no `rebuildPackEmbeddings`): it only validates/persists/reflects
 *    `embeddings.json` produced by the Python Worker.
 *  - The single remaining TS embedding is runtime QUERY embedding, exposed by a
 *    dedicated module that uses the adapter's single-text `embed()` only.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, test } from "node:test";
import { embedSearchQuery } from "@/lib/embedding/runtime-query-embedding";
import type {
  EmbeddingProviderAdapter,
} from "@/lib/embedding/embedding-provider-adapter";

const root = process.cwd();

function read(relPath: string): string {
  return readFileSync(join(root, relPath), "utf8");
}

describe("P7.6 embedding ownership", () => {
  it("chunk-embedding-service no longer generates document/chunk embeddings", () => {
    const src = read("src/lib/chunk-embedding-service.ts");
    assert.ok(!src.includes("rebuildPackEmbeddings"), "generator must be removed");
    assert.ok(!src.includes(".embedBatch("), "no passage embedding in TS");
    // Read-side helpers remain.
    assert.ok(src.includes("export function computeChunkContentHash"));
    assert.ok(src.includes("export async function getPackEmbeddingSummary"));
  });

  it("ZIP Worker import path never re-embeds Worker output", () => {
    const dir = join(root, "src/lib/python-worker");
    const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
    for (const file of files) {
      const src = readFileSync(join(dir, file), "utf8");
      assert.ok(
        !src.includes("rebuildPackEmbeddings"),
        `${file} must not call the (removed) TS embedding generator`,
      );
      assert.ok(
        !src.includes(".embedBatch("),
        `${file} must not generate embeddings (Worker owns embeddings.json)`,
      );
    }
  });

  it("legacy Docling embed step is fail-closed (no TS re-embed)", () => {
    const src = read("src/lib/search-data/search-data-generation-process-embed.ts");
    assert.ok(!src.includes("rebuildPackEmbeddings"));
    assert.ok(src.includes("LEGACY_BUILDER_DISABLED"));
  });

  it("runtime query embedding module uses embed() only (never embedBatch)", () => {
    const src = read("src/lib/embedding/runtime-query-embedding.ts");
    assert.ok(src.includes("adapter.embed("));
    assert.ok(!src.includes("embedBatch"));
    assert.ok(!src.includes("chunk-embedding-service"));
  });
});

test("embedSearchQuery uses adapter.embed and never adapter.embedBatch", async () => {
  let embedCalls = 0;
  const fakeAdapter = {
    resolveDescriptor: () => ({
      provider: "p",
      model: "m",
      modelRevision: "r",
      dimension: 3,
    }),
    async healthCheck() {
      return { ok: true };
    },
    async embed(input: { text: string }) {
      embedCalls += 1;
      assert.ok(input.text.length > 0);
      return { vector: [0.1, 0.2, 0.3] };
    },
    async embedBatch() {
      throw new Error("embedBatch must not be called for query embedding");
    },
  } as unknown as EmbeddingProviderAdapter;

  const result = await embedSearchQuery({
    descriptor: { provider: "p", model: "m", modelRevision: "r", dimension: 3 },
    text: "hello world",
    resolveAdapter: () => fakeAdapter,
  });

  assert.deepEqual(result.vector, [0.1, 0.2, 0.3]);
  assert.equal(embedCalls, 1);
});
