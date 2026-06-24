import { describe, expect, it, vi, beforeEach } from "vitest";

describe("fetchKnowledgeGraphRevisions client", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            revisions: [
              {
                id: "r1",
                revisionNumber: 1,
                title: "대화 저장",
                summary: null,
                nodeCount: 0,
                edgeCount: 0,
                createdAt: "2026-06-24T10:10:00.000Z",
              },
            ],
          },
        }),
      }),
    );
  });

  it("parses list envelope", async () => {
    const { fetchKnowledgeGraphRevisions } = await import(
      "@/lib/project-knowledge/projectKnowledgeGraphRevisionClient"
    );
    const list = await fetchKnowledgeGraphRevisions("p1");
    expect(list).toHaveLength(1);
    expect(list[0]?.title).toBe("대화 저장");
  });
});
