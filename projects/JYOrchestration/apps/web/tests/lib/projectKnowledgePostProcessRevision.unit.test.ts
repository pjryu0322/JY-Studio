import { describe, expect, it, vi } from "vitest";

const recordMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/project-knowledge/projectKnowledgeGraphRevisionService", () => ({
  recordKnowledgeGraphRevisionForMilestone: (...args: unknown[]) => recordMock(...args),
}));

vi.mock("@/lib/project-knowledge/projectKnowledgePipelineGraphMetrics", () => ({
  syncProjectGraphProjectionWithTotals: vi.fn().mockResolvedValue({
    graphNodeCount: 1,
    graphEdgeCount: 0,
  }),
}));

vi.mock("@/lib/project-structure/projectStructureExtractor", () => ({
  extractStructureCandidatesFromEventStore: vi.fn().mockResolvedValue({
    eventCount: 1,
    nodeCount: 0,
    edgeCount: 0,
  }),
}));

vi.mock("@/lib/project-knowledge/projectKnowledgePipelineMonitor", () => ({
  startKnowledgePipelineStep: vi.fn().mockResolvedValue(null),
  completeKnowledgePipelineStep: vi.fn().mockResolvedValue(undefined),
  failKnowledgePipelineStep: vi.fn().mockResolvedValue(undefined),
}));

import { runProjectKnowledgePostProcess } from "@/lib/project-knowledge/projectKnowledgePostProcess";

describe("runProjectKnowledgePostProcess revisions", () => {
  it("records graph_projection revision after successful sync", async () => {
    recordMock.mockClear();
    const result = await runProjectKnowledgePostProcess({ projectId: "p1" });
    expect(result.graphSync).toBe("ok");
    expect(recordMock).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "p1", milestone: "graph_projection" }),
    );
  });
});
