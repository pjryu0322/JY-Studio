import { describe, expect, it } from "vitest";
import { buildKnowledgePackPromptContext, stripKnowledgePackContextMarkdownWrapper } from "@/lib/knowledge-packs/knowledgePackPromptContextBuilder";
import type { KnowledgePackRetrievalResult } from "@/lib/knowledge-packs/knowledgePackRetrievalService";

function baseRetrieval(over: Partial<KnowledgePackRetrievalResult> = {}): KnowledgePackRetrievalResult {
  return {
    mode: "KEYWORD",
    knowledgePackId: "kp_test",
    query: "login",
    chunks: [],
    promptContext: [],
    diagnostics: ["mode=KEYWORD"],
    ...over,
  };
}

describe("knowledgePackPromptContextBuilder", () => {
  it("includes injection-safety notice", () => {
    const text = buildKnowledgePackPromptContext({
      agentRole: "AI_DEVELOPER",
      retrieval: baseRetrieval(),
    });
    expect(text).toContain("참고 지식");
    expect(text).toContain("시스템 지시");
    expect(text).toContain("TODO");
  });

  it("lists promptContext when chunks exist", () => {
    const text = buildKnowledgePackPromptContext({
      agentRole: "AI_DEVELOPER",
      taskTitle: "Kakao Login 구현",
      retrieval: baseRetrieval({
        chunks: [
          {
            chunkId: "c1",
            knowledgePackId: "kp_test",
            sourceId: "s1",
            sourceTitle: "Kakao 문서",
            sourceUrl: "https://example.com",
            chunkOrder: 0,
            score: 5,
            text: "hello",
            excerpt: "hello",
          },
        ],
        promptContext: ["[Kakao 문서] Redirect URI 설정"],
      }),
    });
    expect(text).toContain("Kakao Login 구현");
    expect(text).toContain("적용 지식");
    expect(text).toContain("Redirect URI");
    expect(text).toContain("Secret/API Key");
  });

  it("applies maxChars", () => {
    const longLine = "z".repeat(8000);
    const text = buildKnowledgePackPromptContext({
      agentRole: "AI_DEVELOPER",
      retrieval: baseRetrieval({
        chunks: [
          {
            chunkId: "c1",
            knowledgePackId: "kp_test",
            sourceId: "s1",
            sourceTitle: "Doc",
            sourceUrl: null,
            chunkOrder: 0,
            score: 1,
            text: "x",
            excerpt: "x",
          },
        ],
        promptContext: [longLine],
      }),
      maxChars: 800,
    });
    expect(text.length).toBeLessThanOrEqual(850);
    expect(text).toContain("truncated");
  });

  it("stripKnowledgePackContextMarkdownWrapper removes outer heading once", () => {
    const inner = stripKnowledgePackContextMarkdownWrapper("## Knowledge Pack Context\n\nAgent Role: X\nbody");
    expect(inner).not.toMatch(/^##\s*Knowledge Pack Context/);
    expect(inner).toContain("Agent Role:");
  });
});
