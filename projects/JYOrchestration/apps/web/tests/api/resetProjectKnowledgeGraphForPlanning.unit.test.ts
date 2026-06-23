import { describe, expect, it, vi, beforeEach } from "vitest";

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

import { resetProjectKnowledgeGraphForPlanning } from "@/lib/project-graph/resetProjectKnowledgeGraphForPlanning";

describe("resetProjectKnowledgeGraphForPlanning", () => {
  beforeEach(() => {
    Object.values(deleteManyMocks).forEach((m) => {
      m.mockReset();
      m.mockResolvedValue({ count: 1 });
    });
  });

  it("clears graph, candidates, and event store for project", async () => {
    const result = await resetProjectKnowledgeGraphForPlanning("proj-1");
    expect(deleteManyMocks.event).toHaveBeenCalledWith({ where: { projectId: "proj-1" } });
    expect(deleteManyMocks.message).toHaveBeenCalledWith({ where: { projectId: "proj-1" } });
    expect(deleteManyMocks.candidate).toHaveBeenCalled();
    expect(result.deletedProjectEvents).toBeGreaterThan(0);
  });
});
