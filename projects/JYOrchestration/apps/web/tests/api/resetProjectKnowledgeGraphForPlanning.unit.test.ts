import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteManyMocks = {
  graphEdge: vi.fn(),
  graphNode: vi.fn(),
  candidateEdge: vi.fn(),
  candidate: vi.fn(),
  event: vi.fn(),
  message: vi.fn(),
  nodeLifecycle: vi.fn(),
  mergeHistory: vi.fn(),
};

const appendEventMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectGraphEdge: { deleteMany: (...a: unknown[]) => deleteManyMocks.graphEdge(...a) },
    projectGraphNode: { deleteMany: (...a: unknown[]) => deleteManyMocks.graphNode(...a) },
    projectStructureCandidateEdge: { deleteMany: (...a: unknown[]) => deleteManyMocks.candidateEdge(...a) },
    projectStructureCandidate: { deleteMany: (...a: unknown[]) => deleteManyMocks.candidate(...a) },
    projectNodeLifecycle: { deleteMany: (...a: unknown[]) => deleteManyMocks.nodeLifecycle(...a) },
    projectMergeHistory: { deleteMany: (...a: unknown[]) => deleteManyMocks.mergeHistory(...a) },
    projectEvent: { deleteMany: (...a: unknown[]) => deleteManyMocks.event(...a) },
    projectMessage: { deleteMany: (...a: unknown[]) => deleteManyMocks.message(...a) },
    $transaction: (ops: Promise<{ count: number }>[]) => Promise.all(ops),
  },
}));

vi.mock("@/lib/project-graph/projectGraphProjection", () => ({
  clearProjectGraphProjection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/prisma/prismaOptionalTableOps", () => ({
  runPrismaIgnoreMissingTable: (fn: () => Promise<{ count: number }>) => fn(),
}));

vi.mock("@/lib/project-process/projectEventStore", () => ({
  appendProjectEvent: (...args: unknown[]) => appendEventMock(...args),
}));

import { resetProjectKnowledgeGraphForPlanning } from "@/lib/project-graph/resetProjectKnowledgeGraphForPlanning";
import { PLANNING_GRAPH_RESET_EVENT_TYPE } from "@/lib/project-graph/planningGraphResetEvent";

describe("resetProjectKnowledgeGraphForPlanning", () => {
  beforeEach(() => {
    Object.values(deleteManyMocks).forEach((m) => {
      m.mockReset();
      m.mockResolvedValue({ count: 1 });
    });
    appendEventMock.mockReset();
    appendEventMock.mockResolvedValue({ id: "reset-event-1" });
  });

  it("clears graph, candidates, and event store for project", async () => {
    const result = await resetProjectKnowledgeGraphForPlanning("proj-1", { reason: "planning_reset" });
    expect(deleteManyMocks.event).toHaveBeenCalledWith({ where: { projectId: "proj-1" } });
    expect(deleteManyMocks.message).toHaveBeenCalledWith({ where: { projectId: "proj-1" } });
    expect(deleteManyMocks.graphNode).toHaveBeenCalled();
    expect(deleteManyMocks.graphEdge).toHaveBeenCalled();
    expect(deleteManyMocks.candidate).toHaveBeenCalled();
    expect(result.deletedProjectEvents).toBeGreaterThan(0);
    expect(result.resetEventId).toBe("reset-event-1");
    expect(result.resetAt).toBeTruthy();
  });

  it("records planning_graph_reset marker event after deletes", async () => {
    await resetProjectKnowledgeGraphForPlanning("proj-1", { reason: "planning_reset" });
    expect(appendEventMock).toHaveBeenCalledTimes(1);
    const call = appendEventMock.mock.calls[0]?.[1] as { eventType?: string; payload?: Record<string, unknown> };
    expect(call?.eventType).toBe(PLANNING_GRAPH_RESET_EVENT_TYPE);
    expect(call?.payload?.deletedGraphNodes).toBe(1);
    expect(call?.payload?.eventType).toBe(PLANNING_GRAPH_RESET_EVENT_TYPE);
  });
});
