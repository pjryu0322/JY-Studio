import { describe, expect, it } from "vitest";
import { scoreKnowledgePackChunkAgainstQuery } from "@/lib/knowledge-packs/knowledgePackRetrievalService";

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
