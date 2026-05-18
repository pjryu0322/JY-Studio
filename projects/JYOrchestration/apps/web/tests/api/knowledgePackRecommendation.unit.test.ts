import { describe, expect, it, vi } from "vitest";

const findMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    kpKnowledgePack: {
      findMany: (...args: unknown[]) => findMany(...args),
    },
  },
}));

import { recommendKnowledgePacks } from "@/lib/knowledge-packs/knowledgePackRecommendationService";

describe("recommendKnowledgePacks", () => {
  it("returns auth.kakao-login for Kakao login text", async () => {
    findMany.mockResolvedValueOnce([]);
    const r = await recommendKnowledgePacks({
      userId: "u1",
      text: "프로토타입에 Kakao Login과 Redirect URI를 적용한다.",
      agentRole: "AI_DEVELOPER",
      limit: 5,
    });
    const top = r.recommendations[0];
    expect(top?.knowledgePackId).toBe("auth.kakao-login");
    expect(top?.source).toBe("STATIC");
    expect(top?.score).toBeGreaterThan(0);
    expect(r.diagnostics.length).toBeGreaterThan(0);
  });

  it("recommends grid packs for IBSheet / grid keywords", async () => {
    findMany.mockResolvedValueOnce([]);
    const r = await recommendKnowledgePacks({
      userId: "u1",
      text: "업무용 IBSheet 그리드에 정렬과 페이지네이션을 넣는다.",
      limit: 8,
    });
    const ids = r.recommendations.map((x) => x.knowledgePackId);
    expect(ids.some((id) => id.startsWith("grid."))).toBe(true);
  });

  it("returns AUTH-related static for OAuth token wording", async () => {
    findMany.mockResolvedValueOnce([]);
    const r = await recommendKnowledgePacks({
      userId: "u1",
      text: "OAuth token과 secret을 서버에서만 다룬다.",
      limit: 5,
    });
    expect(r.recommendations.some((x) => x.knowledgePackId === "auth.kakao-login")).toBe(true);
  });

  it("returns empty when text empty", async () => {
    const r = await recommendKnowledgePacks({ userId: "u1", text: "   ", limit: 3 });
    expect(r.recommendations).toEqual([]);
    expect(r.diagnostics).toContain("empty_text");
  });

  it("respects limit", async () => {
    findMany.mockResolvedValueOnce([]);
    const r = await recommendKnowledgePacks({
      userId: "u1",
      text: "grid table kakao login api 연동",
      limit: 2,
    });
    expect(r.recommendations.length).toBeLessThanOrEqual(2);
  });

  it("applies categoryHints for scoring", async () => {
    findMany.mockResolvedValueOnce([]);
    const withHint = await recommendKnowledgePacks({
      userId: "u1",
      text: "일반 업무 화면",
      categoryHints: ["GRID"],
      limit: 6,
    });
    expect(withHint.recommendations.some((x) => x.knowledgePackId.startsWith("grid."))).toBe(true);
  });

  it("react-table wording still surfaces grid recommendations", async () => {
    findMany.mockResolvedValueOnce([]);
    const r = await recommendKnowledgePacks({
      userId: "u1",
      text: "react-table 기반 목록 화면",
      limit: 6,
    });
    expect(r.recommendations.some((x) => x.knowledgePackId.startsWith("grid."))).toBe(true);
  });

  it("includes DB API packs when prisma returns rows", async () => {
    findMany.mockResolvedValueOnce([
      {
        id: "kp_api_1",
        name: "Partner API",
        category: "API",
        summary: "REST integration guide",
        vendor: "ACME",
        status: "ACTIVE",
        agentsJson: '["AI_DEVELOPER"]',
      },
    ]);
    const r = await recommendKnowledgePacks({
      userId: "u1",
      text: "외부 partner REST API webhook 연동",
      limit: 10,
    });
    expect(r.recommendations.some((x) => x.knowledgePackId === "kp_api_1")).toBe(true);
    const row = r.recommendations.find((x) => x.knowledgePackId === "kp_api_1");
    expect(row?.source).toBe("DB");
  });
});
