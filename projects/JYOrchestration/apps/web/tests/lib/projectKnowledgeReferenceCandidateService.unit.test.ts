import { describe, expect, it, vi, beforeEach } from "vitest";

const graphMock = vi.fn();
const loadLatest = vi.fn();
const loadLatestReference = vi.fn();
const ensureReady = vi.fn();

vi.mock("@/lib/project-graph/projectGraphSnapshotEnrich", () => ({
  getProjectGraphSnapshotWithExplainability: (...args: unknown[]) => graphMock(...args),
}));

vi.mock("@/lib/project-knowledge/projectKnowledgeGraphRevisionService", () => ({
  loadLatestKnowledgeGraphRevision: (...args: unknown[]) => loadLatest(...args),
  loadLatestReferenceKnowledgeGraphRevision: (...args: unknown[]) => loadLatestReference(...args),
}));

vi.mock("@/lib/project-knowledge/projectKnowledgeReferenceBackfillService", () => ({
  ensureProjectReferenceMetadataReady: (...args: unknown[]) => ensureReady(...args),
}));

import {
  buildProjectReferenceAssessment,
  buildReferencePackageCandidate,
} from "@/lib/project-knowledge/projectKnowledgeReferenceCandidateService";

const liveGraphNodes = [
  {
    nodeType: "Actor",
    title: "라이브 전용 Actor",
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
    projectionKey: "live-a",
  },
  {
    nodeType: "ServiceFlow",
    title: "라이브 전용 Flow",
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
    projectionKey: "live-f",
  },
  {
    nodeType: "Feature",
    title: "라이브 전용 기능",
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
    projectionKey: "live",
  },
];

const referenceSnapshot = {
  purpose: "REFERENCE_CANDIDATE" as const,
  nodes: [
    {
      entityKey: "snap-1",
      nodeType: "Actor",
      title: "스냅샷 고객",
      summary: null,
      reference: {
        lifecycle: "USER_APPROVED" as const,
        reusable: true,
        reusableAs: ["ACTOR" as const],
        safeForReference: true,
      },
    },
    {
      entityKey: "snap-2",
      nodeType: "ServiceFlow",
      title: "스냅샷 흐름",
      summary: null,
      reference: {
        lifecycle: "USER_APPROVED" as const,
        reusable: true,
        reusableAs: ["SERVICE_FLOW" as const],
        safeForReference: true,
      },
    },
    {
      entityKey: "snap-3",
      nodeType: "Feature",
      title: "스냅샷 기능",
      summary: null,
      reference: {
        lifecycle: "USER_APPROVED" as const,
        reusable: true,
        reusableAs: ["FEATURE" as const],
        safeForReference: true,
      },
    },
  ],
  edges: [],
};

describe("buildReferencePackageCandidate snapshot source", () => {
  beforeEach(() => {
    graphMock.mockReset();
    loadLatest.mockReset();
    loadLatestReference.mockReset();
    ensureReady.mockReset();
    ensureReady.mockResolvedValue(undefined);
    graphMock.mockResolvedValue({ nodes: liveGraphNodes, edges: [] });
    loadLatest.mockResolvedValue({
      id: "replay-latest",
      revisionNumber: 99,
      title: "대화 저장",
      summary: null,
      nodeCount: 1,
      edgeCount: 0,
      createdAt: "2026-06-25T10:00:00.000Z",
      graphSnapshot: { purpose: "REPLAY", nodes: [], edges: [] },
    });
  });

  it("has no sourceRevisionId without reference revision", async () => {
    loadLatestReference.mockResolvedValue(null);
    const candidate = await buildReferencePackageCandidate("p1");
    expect(candidate.sourceRevisionId).toBeUndefined();
    expect(candidate.reusableAssets.features).not.toContain("라이브 전용 기능");
  });

  it("uses snapshot nodes for reusableAssets when reference revision exists", async () => {
    loadLatestReference.mockResolvedValue({
      id: "ref-snap",
      revisionNumber: 8,
      title: "추천안 승인",
      summary: null,
      nodeCount: 3,
      edgeCount: 0,
      createdAt: "2026-06-24T10:00:00.000Z",
      graphSnapshot: referenceSnapshot,
    });

    const candidate = await buildReferencePackageCandidate("p1");
    expect(candidate.sourceRevisionId).toBe("ref-snap");
    expect(candidate.reusableAssets.actors).toContain("스냅샷 고객");
    expect(candidate.reusableAssets.serviceFlows).toContain("스냅샷 흐름");
    expect(candidate.reusableAssets.features).toContain("스냅샷 기능");
    expect(candidate.reusableAssets.features).not.toContain("라이브 전용 기능");
  });

  it("assessment exposes snapshotReusableAssets separate from live graph", async () => {
    loadLatestReference.mockResolvedValue({
      id: "ref-snap",
      revisionNumber: 8,
      title: "추천안 승인",
      summary: null,
      nodeCount: 3,
      edgeCount: 0,
      createdAt: "2026-06-24T10:00:00.000Z",
      graphSnapshot: referenceSnapshot,
    });

    const assessment = await buildProjectReferenceAssessment("p1");
    expect(assessment.latestRevision?.id).toBe("replay-latest");
    expect(assessment.latestReferenceRevision?.id).toBe("ref-snap");
    expect(assessment.snapshotReusableAssets?.actors).toContain("스냅샷 고객");
    expect(ensureReady).not.toHaveBeenCalled();
  });

  it("calls ensureProjectReferenceMetadataReady before building candidate", async () => {
    loadLatestReference.mockResolvedValue(null);
    await buildReferencePackageCandidate("p1");
    expect(ensureReady).toHaveBeenCalledWith("p1");
  });
});
