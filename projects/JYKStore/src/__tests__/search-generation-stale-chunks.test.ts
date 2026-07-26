import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("markSearchGenerationStale chunk deactivation", () => {
  it("deactivates KnowledgeChunks for generations marked STALE", () => {
    const src = readSource("src/lib/search-generation/search-generation-service.ts");
    assert.match(src, /export async function markSearchGenerationStale/);
    assert.match(src, /knowledgeChunk\.updateMany/);
    assert.match(src, /isActive:\s*false/);
    assert.match(src, /chunkGenerationId:\s*\{\s*in:\s*chunkGenerationIds\s*\}/);
  });
});
