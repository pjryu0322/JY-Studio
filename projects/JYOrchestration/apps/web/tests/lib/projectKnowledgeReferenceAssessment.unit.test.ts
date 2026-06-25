import { describe, expect, it, vi, beforeEach } from "vitest";

const graphMock = vi.fn();
const loadLatest = vi.fn();
const loadLatestReference = vi.fn();

vi.mock("@/lib/project-graph/projectGraphSnapshotEnrich", () => ({
  getProjectGraphSnapshotWithExplainability: (...args: unknown[]) => graphMock(...args),
}));

vi.mock("@/lib/project-knowledge/projectKnowledgeGraphRevisionService", () => ({
  loadLatestKnowledgeGraphRevision: (...args: unknown[]) => loadLatest(...args),
  loadLatestReferenceKnowledgeGraphRevision: (...args: unknown[]) => loadLatestReference(...args),
}));

import { buildProjectReferenceAssessment } from "@/lib/project-knowledge/projectKnowledgeReferenceCandidateService";

const approvedNodes = [
  {
    nodeType: "Actor",
    title: "고객",
    summary: null,
    metadata: {
      reference: {
        lifecycle: "USER_APPROVED",
        provenance: { createdFrom: "USER_APPROVAL" },
        reusable: true,
        reusableAs: ["ACTOR"],
        sensitivity: {
          containsPersonalData: false,
          containsConfidentialData: false,
          containsRawConversation: false,
          containsInternalIds: false,
          safeForReference: true,
        },
      },
    },
    projectionKey: "k1",
  },
  {
    nodeType: "ServiceFlow",
    title: "주문",
    summary: null,
    metadata: {
      reference: {
        lifecycle: "USER_APPROVED",
        provenance: { createdFrom: "USER_APPROVAL" },
        reusable: true,
        reusableAs: ["SERVICE_FLOW"],
        sensitivity: {
          containsPersonalData: false,
          containsConfidentialData: false,
          containsRawConversation: false,
          containsInternalIds: false,
          safeForReference: true,
        },
      },
    },
    projectionKey: "k2",
  },
  {
    nodeType: "Feature",
    title: "결제",
    summary: null,
    metadata: {
      reference: {
        lifecycle: "USER_APPROVED",
        provenance: { createdFrom: "USER_APPROVAL" },
        reusable: true,
        reusableAs: ["FEATURE"],
        sensitivity: {
          containsPersonalData: false,
          containsConfidentialData: false,
          containsRawConversation: false,
          containsInternalIds: false,
          safeForReference: true,
        },
      },
    },
    projectionKey: "k3",
  },
];

describe("buildProjectReferenceAssessment", () => {
  beforeEach(() => {
    graphMock.mockReset();
    loadLatest.mockReset();
    loadLatestReference.mockReset();
    graphMock.mockResolvedValue({ nodes: approvedNodes, edges: [] });
    loadLatest.mockResolvedValue({
      id: "replay-latest",
      revisionNumber: 10,
      title: "대화 저장",
      summary: null,
      nodeCount: 3,
      edgeCount: 0,
      createdAt: "2026-06-25T10:00:00.000Z",
      graphSnapshot: { purpose: "REPLAY", nodes: [], edges: [] },
    });
  });

  it("returns READY_FOR_SNAPSHOT when no latestReferenceRevision", async () => {
    loadLatestReference.mockResolvedValue(null);
    const assessment = await buildProjectReferenceAssessment("p1");
    expect(assessment.eligibility.level).toBe("READY_FOR_SNAPSHOT");
    expect(assessment.eligibility.eligible).toBe(false);
    expect(assessment.latestRevision?.id).toBe("replay-latest");
    expect(assessment.latestReferenceRevision).toBeNull();
  });

  it("returns SNAPSHOT_READY when reference candidate revision exists", async () => {
    loadLatestReference.mockResolvedValue({
      id: "ref-cand",
      revisionNumber: 8,
      title: "추천안 승인",
      summary: null,
      nodeCount: 3,
      edgeCount: 0,
      createdAt: "2026-06-24T10:00:00.000Z",
      graphSnapshot: { purpose: "REFERENCE_CANDIDATE", nodes: [], edges: [] },
    });
    const assessment = await buildProjectReferenceAssessment("p1");
    expect(assessment.eligibility.level).toBe("SNAPSHOT_READY");
    expect(assessment.eligibility.eligible).toBe(true);
    expect(assessment.latestRevision?.id).not.toBe(assessment.latestReferenceRevision?.id);
  });

  it("returns VERIFIED for REFERENCE_PACKAGE reference revision", async () => {
    loadLatestReference.mockResolvedValue({
      id: "ref-pkg",
      revisionNumber: 9,
      title: "패키지",
      summary: null,
      nodeCount: 3,
      edgeCount: 0,
      createdAt: "2026-06-24T11:00:00.000Z",
      graphSnapshot: { purpose: "REFERENCE_PACKAGE", nodes: [], edges: [] },
    });
    const assessment = await buildProjectReferenceAssessment("p1");
    expect(assessment.eligibility.level).toBe("VERIFIED");
  });
});
