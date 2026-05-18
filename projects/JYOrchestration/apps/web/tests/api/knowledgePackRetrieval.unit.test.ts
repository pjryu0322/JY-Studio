import { describe, expect, it } from "vitest";
import {
  buildPromptContextFromRetrievedChunks,
  scoreKnowledgePackChunkAgainstQuery,
} from "@/lib/knowledge-packs/knowledgePackRetrievalService";
import type { RetrievedKnowledgePackChunk } from "@/lib/knowledge-packs/knowledgePackRetrievalService";

describe("knowledgePackRetrievalService (keyword score)", () => {
  it("returns 0 for empty or too-short query terms", () => {
    expect(scoreKnowledgePackChunkAgainstQuery("hello world", "")).toBe(0);
    expect(scoreKnowledgePackChunkAgainstQuery("hello world", "a")).toBe(0);
  });

  it("scores higher when terms appear more often", () => {
    const s1 = scoreKnowledgePackChunkAgainstQuery("foo bar baz", "foo");
    const s2 = scoreKnowledgePackChunkAgainstQuery("foo foo bar baz", "foo");
    expect(s2).toBeGreaterThan(s1);
  });

  it("matches korean terms", () => {
    const s = scoreKnowledgePackChunkAgainstQuery("그리드 컴포넌트는 가상 스크롤을 지원합니다.", "가상 스크롤");
    expect(s).toBeGreaterThan(0);
  });
});

describe("buildPromptContextFromRetrievedChunks", () => {
  const mk = (text: string, title = "Doc"): RetrievedKnowledgePackChunk => ({
    chunkId: "c1",
    knowledgePackId: "kp_x",
    sourceId: "s1",
    sourceTitle: title,
    sourceUrl: "https://example.com/a",
    chunkOrder: 0,
    score: 10,
    text,
    excerpt: text.slice(0, 80),
  });

  it("adds diagnostics when total budget is exceeded", () => {
    const chunks = Array.from({ length: 8 }, (_, i) => mk("p".repeat(2000), `Source ${i}`));
    const { promptContext, diagnostics } = buildPromptContextFromRetrievedChunks(chunks);
    expect(promptContext.length).toBeGreaterThanOrEqual(1);
    expect(diagnostics.some((d) => d.includes("promptContext_total_max"))).toBe(true);
  });

  it("truncates per chunk over 900 chars in prompt line", () => {
    const t = "y".repeat(1200);
    const { diagnostics } = buildPromptContextFromRetrievedChunks([mk(t)]);
    expect(diagnostics.some((d) => d.startsWith("promptContext_per_chunk_truncated"))).toBe(true);
  });
});
