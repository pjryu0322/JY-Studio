import { describe, expect, it, vi } from "vitest";
import type { KnowledgePackRetrievalResult } from "@/lib/knowledge-packs/knowledgePackRetrievalService";

const { mockRetrieve } = vi.hoisted(() => ({
  mockRetrieve: vi.fn(),
}));

vi.mock("@/lib/knowledge-packs/knowledgePackRetrievalService", () => ({
  retrieveKnowledgePackKeywordRetrievalResult: mockRetrieve,
}));

import { buildKnowledgePackContextForDeveloperTask } from "@/lib/knowledge-packs/knowledgePackPromptInjectionAdapter";

describe("buildKnowledgePackContextForDeveloperTask", () => {
  it("returns context with headings and diagnostics when retrieval is empty", async () => {
    mockRetrieve.mockResolvedValueOnce({
      mode: "KEYWORD",
      knowledgePackId: "kp_test",
      query: "q",
      chunks: [],
      promptContext: [],
      diagnostics: ["no_chunks"],
    } satisfies KnowledgePackRetrievalResult);

    const r = await buildKnowledgePackContextForDeveloperTask({
      userId: "user_1",
      knowledgePackId: "kp_test",
      query: "oauth",
      taskTitle: "Task",
    });
    expect(r.contextText).toMatch(/## Knowledge Pack Context/);
    expect(r.contextText).toMatch(/검색 결과 없음/);
    expect(r.diagnostics.some((d) => d.includes("no_chunks"))).toBe(true);
    expect(r.diagnostics.some((d) => d.startsWith("context_chars="))).toBe(true);
  });

  it("respects max length via builder (long chunk text)", async () => {
    const long = "x".repeat(20_000);
    mockRetrieve.mockResolvedValueOnce({
      mode: "KEYWORD",
      knowledgePackId: "kp_test",
      query: "q",
      chunks: [
        {
          chunkId: "c1",
          knowledgePackId: "kp_test",
          sourceId: "s1",
          sourceTitle: "S",
          sourceUrl: "https://example.com",
          chunkOrder: 0,
          score: 10,
          text: long,
          excerpt: long.slice(0, 100),
        },
      ],
      promptContext: ["line"],
      diagnostics: [],
    } satisfies KnowledgePackRetrievalResult);

    const r = await buildKnowledgePackContextForDeveloperTask({
      userId: "user_1",
      knowledgePackId: "kp_test",
      query: "q",
    });
    expect(r.contextText.length).toBeLessThanOrEqual(6200);
  });
});
