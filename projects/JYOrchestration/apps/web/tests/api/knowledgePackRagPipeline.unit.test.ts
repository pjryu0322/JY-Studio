import { describe, it, expect } from "vitest";
import {
  chunkKnowledgePackTextStub,
  collectKnowledgePackSourceStub,
  createKnowledgePackEmbeddingStub,
  saveKnowledgePackVectorsStub,
} from "@/lib/knowledge-packs/knowledgePackRagPipeline";

describe("knowledgePackRagPipeline stubs", () => {
  it("collectKnowledgePackSourceStub returns pending stub without network", async () => {
    const r = await collectKnowledgePackSourceStub({ knowledgePackId: "kp_1", urlHint: "https://example.com" });
    expect(r.status).toBe("PENDING");
    expect(r.message).toMatch(/Stub|미구현/i);
    expect(r.sourceId).toContain("kp_1");
  });

  it("chunkKnowledgePackTextStub splits long text and encodes ids", () => {
    const text = "a".repeat(1200);
    const chunks = chunkKnowledgePackTextStub({
      knowledgePackId: "kp_x",
      sourceId: "src_y",
      text,
      maxChunkChars: 400,
    });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].id).toContain("kp_x");
    expect(chunks[0].id).toContain("src_y");
    expect(chunks[0].knowledgePackId).toBe("kp_x");
    expect(chunks[0].sourceId).toBe("src_y");
    expect(chunks.map((c) => c.text).join("")).toBe(text);
  });

  it("createKnowledgePackEmbeddingStub returns stub records without vectors", async () => {
    const chunks = chunkKnowledgePackTextStub({
      knowledgePackId: "kp_1",
      sourceId: "s1",
      text: "hello world",
      maxChunkChars: 5,
    });
    const emb = await createKnowledgePackEmbeddingStub(chunks);
    expect(emb.length).toBe(chunks.length);
    expect(emb[0].provider).toBe("STUB");
    expect(emb[0].model).toBe("not-implemented");
    expect(emb[0].vector).toBeUndefined();
  });

  it("saveKnowledgePackVectorsStub returns NOT_IMPLEMENTED", async () => {
    const emb = await createKnowledgePackEmbeddingStub([
      {
        id: "kp_1_s1_chunk_0",
        knowledgePackId: "kp_1",
        sourceId: "s1",
        text: "x",
        order: 0,
      },
    ]);
    const r = await saveKnowledgePackVectorsStub(emb);
    expect(r.status).toBe("NOT_IMPLEMENTED");
  });
});
