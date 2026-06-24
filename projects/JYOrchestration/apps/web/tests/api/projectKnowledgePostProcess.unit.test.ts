import { describe, expect, it, vi, beforeEach } from "vitest";

const extractMock = vi.fn();
const graphSyncMock = vi.fn();

vi.mock("@/lib/project-structure/projectStructureExtractor", () => ({
  extractStructureCandidatesFromEventStore: (...args: unknown[]) => extractMock(...args),
}));

vi.mock("@/lib/project-knowledge/projectKnowledgePipelineGraphMetrics", () => ({
  syncProjectGraphProjectionWithTotals: (...args: unknown[]) => graphSyncMock(...args),
}));

import { runProjectKnowledgePostProcess } from "@/lib/project-knowledge/projectKnowledgePostProcess";

describe("runProjectKnowledgePostProcess", () => {
  beforeEach(() => {
    extractMock.mockReset();
    graphSyncMock.mockReset();
    extractMock.mockResolvedValue({ eventCount: 1, nodeCount: 4, edgeCount: 2 });
    graphSyncMock.mockResolvedValue({ appliedCount: 1, graphNodeCount: 10, graphEdgeCount: 7 });
  });

  it("runs candidate extraction and graph projection with separate metrics", async () => {
    const result = await runProjectKnowledgePostProcess({
      projectId: "p1",
      eventIds: ["ev-1"],
      reason: "test",
    });
    expect(extractMock).toHaveBeenCalledWith("p1");
    expect(graphSyncMock).toHaveBeenCalledWith("p1", ["ev-1"]);
    expect(result.ok).toBe(true);
    expect(result.candidateSync).toBe("ok");
    expect(result.graphSync).toBe("ok");
    expect(result.metrics?.candidateNodeCount).toBe(4);
    expect(result.metrics?.candidateEdgeCount).toBe(2);
    expect(result.metrics?.graphNodeCount).toBe(10);
    expect(result.metrics?.graphEdgeCount).toBe(7);
  });

  it("reports candidate sync failure", async () => {
    extractMock.mockRejectedValue(new Error("db"));
    const result = await runProjectKnowledgePostProcess({ projectId: "p1" });
    expect(result.candidateSync).toBe("failed");
    expect(graphSyncMock).toHaveBeenCalled();
  });

  it("reports graph sync failure", async () => {
    graphSyncMock.mockRejectedValue(new Error("graph"));
    const result = await runProjectKnowledgePostProcess({ projectId: "p1" });
    expect(result.graphSync).toBe("failed");
    expect(result.errorCode).toBe("GRAPH_SYNC_FAILED");
  });
});
