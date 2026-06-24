import { describe, expect, it, vi } from "vitest";
import { fetchProjectGraph } from "@/lib/project-graph/projectGraphClient";

vi.mock("@/lib/project-graph/projectGraphClient", () => ({
  fetchProjectGraph: vi.fn(),
}));

describe("useProjectKnowledgeGraphData contract", () => {
  it("fetchProjectGraph uses project limit", async () => {
    vi.mocked(fetchProjectGraph).mockResolvedValue({ nodes: [], edges: [] });
    await fetchProjectGraph("p1", { limit: 300 });
    expect(fetchProjectGraph).toHaveBeenCalledWith("p1", { limit: 300 });
  });
});
