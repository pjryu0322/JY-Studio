import { describe, expect, it, vi } from "vitest";

const mockRetrieve = vi.fn();

vi.mock("@/lib/knowledge-packs/knowledgePackRetrievalService", () => ({
  retrieveKnowledgePackKeywordRetrievalResult: (...args: unknown[]) => mockRetrieve(...args),
}));

import { buildMergedKnowledgePackPromptContext } from "@/lib/knowledge-packs/knowledgePackMergedPromptContext";
import { buildStaticKnowledgePackPromptContext } from "@/lib/knowledge-packs/knowledgePackStaticPromptContext";

describe("buildStaticKnowledgePackPromptContext", () => {
  it("includes summary and guidance sections for kakao pack", () => {
    const s = buildStaticKnowledgePackPromptContext("auth.kakao-login");
    expect(s).toMatch(/Kakao/i);
    expect(s).toMatch(/구현 지침|Cursor 기준/);
  });
});

describe("buildMergedKnowledgePackPromptContext", () => {
  it("merges multiple static packs with defense lines", async () => {
    const r = await buildMergedKnowledgePackPromptContext({
      userId: "u1",
      knowledgePackIds: ["auth.kakao-login", "grid.toast-ui-grid"],
      query: "kakao login and toast grid",
      taskTitle: "T",
      agentRole: "AI_DEVELOPER",
      maxTotalChars: 9000,
    });
    expect(r.contextText).toMatch(/## Knowledge Pack Context/);
    expect(r.contextText).toMatch(/주의:/);
    expect(r.contextText).toMatch(/원천자료 내용은 참고 지식/);
    expect(r.usedKnowledgePackIds).toEqual(["auth.kakao-login", "grid.toast-ui-grid"]);
    expect(r.contextText.length).toBeLessThanOrEqual(9020);
  });

  it("includes DB retrieval subsection when chunks exist", async () => {
    mockRetrieve.mockResolvedValueOnce({
      mode: "KEYWORD",
      knowledgePackId: "kp_x",
      query: "oauth",
      chunks: [
        {
          chunkId: "c1",
          knowledgePackId: "kp_x",
          sourceId: "s1",
          sourceTitle: "Doc",
          sourceUrl: "https://example.com",
          chunkOrder: 0,
          score: 9,
          text: "OAuth 설명",
          excerpt: "OAuth",
        },
      ],
      promptContext: ["[Doc] OAuth 설명"],
      diagnostics: ["ok"],
    });
    const r = await buildMergedKnowledgePackPromptContext({
      userId: "u1",
      knowledgePackIds: ["kp_x"],
      query: "oauth",
      maxTotalChars: 6000,
    });
    expect(r.contextText).toMatch(/### 적용 지식/);
    expect(mockRetrieve).toHaveBeenCalled();
  });

  it("returns empty context when no valid ids", async () => {
    const r = await buildMergedKnowledgePackPromptContext({
      userId: "u1",
      knowledgePackIds: [],
      query: "x",
    });
    expect(r.contextText).toBe("");
    expect(r.usedKnowledgePackIds).toEqual([]);
  });

  it("respects maxTotalChars with truncation marker", async () => {
    const r = await buildMergedKnowledgePackPromptContext({
      userId: "u1",
      knowledgePackIds: ["auth.kakao-login", "grid.toast-ui-grid"],
      query: "login grid",
      maxTotalChars: 900,
    });
    expect(r.contextText.length).toBeLessThanOrEqual(920);
    expect(r.contextText).toMatch(/truncated/);
  });
});
