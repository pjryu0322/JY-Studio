import { describe, expect, it, vi, beforeEach } from "vitest";

const extractMock = vi.fn();
const graphSyncMock = vi.fn();

vi.mock("@/lib/project-structure/projectStructureExtractor", () => ({
  extractStructureCandidatesFromEventStore: (...args: unknown[]) => extractMock(...args),
}));

vi.mock("@/lib/project-graph/projectGraphProjection", () => ({
  trySyncProjectGraphProjection: (...args: unknown[]) => graphSyncMock(...args),
}));

import { runProjectKnowledgePostProcess } from "@/lib/project-knowledge/projectKnowledgePostProcess";

describe("runProjectKnowledgePostProcess", () => {
  beforeEach(() => {
    extractMock.mockReset();
    graphSyncMock.mockReset();
    extractMock.mockResolvedValue({ eventCount: 1, nodeCount: 1, edgeCount: 0 });
  });

  it("runs candidate extraction and graph projection", async () => {
    const result = await runProjectKnowledgePostProcess({
      projectId: "p1",
      eventIds: ["ev-1"],
      reason: "test",
    });
    expect(extractMock).toHaveBeenCalledWith("p1");
    expect(graphSyncMock).toHaveBeenCalledWith("p1", ["ev-1"]);
    expect(result.ok).toBe(true);
    expect(result.candidateSync).toBe("ok");
    expect(result.graphSync).toBe("queued");
  });

  it("reports candidate sync failure", async () => {
    extractMock.mockRejectedValue(new Error("db"));
    const result = await runProjectKnowledgePostProcess({ projectId: "p1" });
    expect(result.candidateSync).toBe("failed");
    expect(result.graphSync).toBe("queued");
  });
});
