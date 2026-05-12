import { describe, expect, it } from "vitest";
import { contentHashForChunk, splitTextIntoOverlappingChunks } from "@/lib/knowledge-packs/knowledgePackChunkCore";

describe("knowledgePackChunkCore", () => {
  it("splitTextIntoOverlappingChunks overlaps and covers full string", () => {
    const text = "a".repeat(500);
    const parts = splitTextIntoOverlappingChunks(text, 200, 40);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join("").length).toBeGreaterThanOrEqual(text.length);
    expect(parts[0]?.length).toBeLessThanOrEqual(200);
  });

  it("contentHashForChunk is stable for same input", () => {
    const h1 = contentHashForChunk("hello");
    const h2 = contentHashForChunk("hello");
    expect(h1).toBe(h2);
    expect(h1.length).toBe(64);
  });
});
