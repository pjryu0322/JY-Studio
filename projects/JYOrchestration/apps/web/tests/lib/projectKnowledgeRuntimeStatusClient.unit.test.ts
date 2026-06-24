import { describe, expect, it, vi, beforeEach } from "vitest";

describe("fetchKnowledgeRuntimeStatus client", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            status: "READY",
            statusLabel: "구조화 완료",
            nodeCount: 8,
            edgeCount: 6,
          },
        }),
      }),
    );
  });

  it("parses API envelope", async () => {
    const { fetchKnowledgeRuntimeStatus } = await import(
      "@/lib/project-knowledge/projectKnowledgeRuntimeStatusClient"
    );
    const summary = await fetchKnowledgeRuntimeStatus("p1");
    expect(summary.status).toBe("READY");
    expect(summary.nodeCount).toBe(8);
  });
});
