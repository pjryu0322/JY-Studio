import { describe, expect, it, vi, beforeEach } from "vitest";

const countNodeMock = vi.fn();
const countEdgeMock = vi.fn();
const syncAfterMock = vi.fn();
const syncProjectMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectGraphNode: { count: (...args: unknown[]) => countNodeMock(...args) },
    projectGraphEdge: { count: (...args: unknown[]) => countEdgeMock(...args) },
  },
}));

vi.mock("@/lib/project-graph/projectGraphProjection", () => ({
  syncProjectGraphProjectionAfterEventIds: (...args: unknown[]) => syncAfterMock(...args),
  syncProjectGraphProjectionForProject: (...args: unknown[]) => syncProjectMock(...args),
}));

import {
  countProjectGraphTotals,
  syncProjectGraphProjectionWithTotals,
} from "@/lib/project-knowledge/projectKnowledgePipelineGraphMetrics";

describe("projectKnowledgePipelineGraphMetrics", () => {
  beforeEach(() => {
    countNodeMock.mockReset();
    countEdgeMock.mockReset();
    syncAfterMock.mockReset();
    syncProjectMock.mockReset();
    countNodeMock.mockResolvedValue(11);
    countEdgeMock.mockResolvedValue(22);
    syncAfterMock.mockResolvedValue({ appliedCount: 2 });
    syncProjectMock.mockResolvedValue({ appliedCount: 1 });
  });

  it("countProjectGraphTotals queries prisma counts", async () => {
    const totals = await countProjectGraphTotals("p1");
    expect(totals.graphNodeCount).toBe(11);
    expect(totals.graphEdgeCount).toBe(22);
  });

  it("syncProjectGraphProjectionWithTotals uses event ids when provided", async () => {
    const result = await syncProjectGraphProjectionWithTotals("p1", ["ev-1"]);
    expect(syncAfterMock).toHaveBeenCalledWith("p1", ["ev-1"]);
    expect(result.graphNodeCount).toBe(11);
    expect(result.appliedCount).toBe(2);
  });

  it("syncProjectGraphProjectionWithTotals syncs full project when no event ids", async () => {
    await syncProjectGraphProjectionWithTotals("p1");
    expect(syncProjectMock).toHaveBeenCalledWith("p1");
  });
});
