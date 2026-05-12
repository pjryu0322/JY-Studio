import { describe, expect, it, vi } from "vitest";

const mockRecommend = vi.fn();
const mockMerge = vi.fn();

vi.mock("@/lib/knowledge-packs/knowledgePackRecommendationService", () => ({
  recommendKnowledgePacks: (...a: unknown[]) => mockRecommend(...a),
}));

vi.mock("@/lib/knowledge-packs/knowledgePackMergedPromptContext", () => ({
  buildMergedKnowledgePackPromptContext: (...a: unknown[]) => mockMerge(...a),
}));

import { resolveWorkUnitKnowledgePackInjection } from "@/lib/knowledge-packs/knowledgePackWorkUnitPromptInjection";

describe("resolveWorkUnitKnowledgePackInjection", () => {
  it("returns skipped when userId empty", async () => {
    const r = await resolveWorkUnitKnowledgePackInjection({
      userId: "  ",
      projectId: "p1",
      textBlob: "kakao",
      taskTitle: "T",
    });
    expect(r.outcome).toBe("skipped");
  });

  it("returns merged when picks exist and merge has body", async () => {
    mockRecommend.mockResolvedValueOnce({
      recommendations: [
        { knowledgePackId: "auth.kakao-login", score: 10, name: "", category: "", source: "STATIC", reasons: [] },
      ],
      diagnostics: ["d1"],
    });
    mockMerge.mockResolvedValueOnce({
      contextText: "## Knowledge Pack Context\n\n**이름:** Kakao",
      diagnostics: ["m1"],
      usedKnowledgePackIds: ["auth.kakao-login"],
    });
    const r = await resolveWorkUnitKnowledgePackInjection({
      userId: "u1",
      projectId: "p1",
      textBlob: "login kakao",
      taskTitle: "Login",
    });
    expect(r.outcome).toBe("merged");
    if (r.outcome === "merged") {
      expect(r.innerMarkdown).not.toMatch(/^##\s*Knowledge Pack Context/);
      expect(r.innerMarkdown).toMatch(/Kakao/);
    }
  });

  it("returns failure when recommend throws", async () => {
    mockRecommend.mockRejectedValueOnce(new Error("db down"));
    const r = await resolveWorkUnitKnowledgePackInjection({
      userId: "u1",
      projectId: "p1",
      textBlob: "text",
      taskTitle: "T",
    });
    expect(r.outcome).toBe("failure");
    if (r.outcome === "failure") expect(r.message).toContain("db down");
  });
});
