import { describe, expect, it, vi, beforeEach } from "vitest";

const { graphNodeCount, graphEdgeCount, candidateCount, getLatestRun, getLatestRevision, buildAssessment } =
  vi.hoisted(() => ({
    graphNodeCount: vi.fn(),
    graphEdgeCount: vi.fn(),
    candidateCount: vi.fn(),
    getLatestRun: vi.fn(),
    getLatestRevision: vi.fn(),
    buildAssessment: vi.fn(),
  }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectGraphNode: { count: graphNodeCount },
    projectGraphEdge: { count: graphEdgeCount },
    projectStructureCandidate: { count: candidateCount },
  },
}));

vi.mock("@/lib/project-knowledge/projectKnowledgePipelineMonitor", () => ({
  getLatestKnowledgePipelineRun: (...args: unknown[]) => getLatestRun(...args),
}));

vi.mock("@/lib/project-knowledge/projectKnowledgeGraphRevisionService", () => ({
  getLatestKnowledgeGraphRevision: (...args: unknown[]) => getLatestRevision(...args),
}));

vi.mock("@/lib/project-knowledge/projectKnowledgeReferenceCandidateService", () => ({
  buildProjectReferenceAssessment: (...args: unknown[]) => buildAssessment(...args),
}));

import { getKnowledgeRuntimeStatusSummary } from "@/lib/project-knowledge/projectKnowledgeRuntimeStatusService";

describe("getKnowledgeRuntimeStatusSummary", () => {
  beforeEach(() => {
    graphNodeCount.mockReset();
    graphEdgeCount.mockReset();
    candidateCount.mockReset();
    getLatestRun.mockReset();
    getLatestRevision.mockReset();
    buildAssessment.mockReset();
    buildAssessment.mockResolvedValue({
      projectId: "p1",
      graphNodeCount: 12,
      graphEdgeCount: 10,
      latestReferenceRevision: null,
      latestRevision: null,
      eligibility: {
        eligible: false,
        level: "NONE",
        reasons: [],
        blockingIssues: [],
        counts: {
          reusableActors: 0,
          reusableServiceFlows: 0,
          reusableFeatures: 0,
          reusableGraphNodes: 0,
        },
      },
      reusableNodes: [],
      exclusions: [],
    });
  });

  it("aggregates counts and READY status", async () => {
    graphNodeCount.mockResolvedValue(12);
    graphEdgeCount.mockResolvedValue(10);
    candidateCount.mockResolvedValue(0);
    getLatestRun.mockResolvedValue({
      status: "COMPLETED",
      startedAt: "2026-06-24T05:00:00.000Z",
      completedAt: "2026-06-24T05:32:00.000Z",
      steps: [],
    });
    getLatestRevision.mockResolvedValue({
      id: "hidden",
      revisionNumber: 1,
      title: "추천안 승인",
      summary: null,
      nodeCount: 12,
      edgeCount: 10,
      createdAt: "2026-06-24T05:32:00.000Z",
    });

    const summary = await getKnowledgeRuntimeStatusSummary("p1");
    expect(summary.status).toBe("READY");
    expect(summary.statusLabel).toBe("구조화 완료");
    expect(summary.nodeCount).toBe(12);
    expect(summary.edgeCount).toBe(10);
    expect(summary.latestChangeTitle).toBe("추천안 승인");
    expect(summary.latestChangedAt).toBe("2026-06-24T05:32:00.000Z");
    expect(summary.referenceEligibilityLabel).toBe("참조 준비 안 됨");
    expect(buildAssessment).toHaveBeenCalledWith("p1");
  });

  it("returns STRUCTURING when latest run is RUNNING", async () => {
    graphNodeCount.mockResolvedValue(0);
    graphEdgeCount.mockResolvedValue(0);
    candidateCount.mockResolvedValue(0);
    getLatestRun.mockResolvedValue({ status: "RUNNING", startedAt: "2026-06-24T05:00:00.000Z", steps: [] });
    getLatestRevision.mockResolvedValue(null);

    const summary = await getKnowledgeRuntimeStatusSummary("p1");
    expect(summary.status).toBe("STRUCTURING");
    expect(summary.statusLabel).toBe("구조화 중");
  });
});
