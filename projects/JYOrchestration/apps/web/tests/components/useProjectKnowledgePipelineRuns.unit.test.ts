import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchKnowledgePipelineRuns } from "@/lib/project-knowledge/projectKnowledgePipelineClient";

vi.mock("@/lib/project-knowledge/projectKnowledgePipelineClient", () => ({
  fetchKnowledgePipelineRuns: vi.fn(),
}));

describe("useProjectKnowledgePipelineRuns contract", () => {
  beforeEach(() => {
    vi.mocked(fetchKnowledgePipelineRuns).mockReset();
    vi.mocked(fetchKnowledgePipelineRuns).mockResolvedValue({
      recentRuns: [{ id: "run-1", projectId: "p1", status: "COMPLETED", steps: [] } as never],
      latestRun: null,
      run: null,
    });
  });

  it("fetchKnowledgePipelineRuns loads recent runs", async () => {
    const data = await fetchKnowledgePipelineRuns("p1", 20);
    expect(fetchKnowledgePipelineRuns).toHaveBeenCalledWith("p1", 20);
    expect(data.recentRuns.length).toBe(1);
  });
});
