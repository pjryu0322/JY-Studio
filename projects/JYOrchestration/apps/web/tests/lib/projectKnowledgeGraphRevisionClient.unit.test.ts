import { describe, expect, it, vi, beforeEach } from "vitest";

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    headers: { get: (name: string) => (name.toLowerCase() === "content-type" ? "application/json" : null) },
    text: async () => JSON.stringify(body),
  };
}

describe("fetchKnowledgeGraphRevisions client", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
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
      ),
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

  it("loads revision detail via revisionId query", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          revision: {
            id: "r1",
            revisionNumber: 1,
            title: "그래프 반영",
            summary: null,
            nodeCount: 0,
            edgeCount: 0,
            createdAt: "2026-06-24T10:10:00.000Z",
            graphSnapshot: { nodes: [], edges: [] },
          },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { fetchKnowledgeGraphRevision } = await import(
      "@/lib/project-knowledge/projectKnowledgeGraphRevisionClient"
    );
    const detail = await fetchKnowledgeGraphRevision("p1", "r1");
    expect(detail.title).toBe("그래프 반영");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("revisionId=r1");
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain("/revisions/r1");
  });
});
