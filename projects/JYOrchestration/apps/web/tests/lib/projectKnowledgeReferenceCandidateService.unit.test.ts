import { describe, expect, it, vi, beforeEach } from "vitest";

const graphMock = vi.fn();
const listRevisions = vi.fn();
const loadRevision = vi.fn();

vi.mock("@/lib/project-graph/projectGraphSnapshotEnrich", () => ({
  getProjectGraphSnapshotWithExplainability: (...args: unknown[]) => graphMock(...args),
}));

vi.mock("@/lib/project-knowledge/projectKnowledgeGraphRevisionService", () => ({
  listKnowledgeGraphRevisions: (...args: unknown[]) => listRevisions(...args),
  loadKnowledgeGraphRevision: (...args: unknown[]) => loadRevision(...args),
  getLatestKnowledgeGraphRevision: async () => null,
  loadLatestKnowledgeGraphRevision: async () => null,
  loadLatestReferenceKnowledgeGraphRevision: async () => null,
}));

import { buildReferencePackageCandidate } from "@/lib/project-knowledge/projectKnowledgeReferenceCandidateService";

describe("buildReferencePackageCandidate", () => {
  beforeEach(() => {
    graphMock.mockReset();
    listRevisions.mockReset();
    loadRevision.mockReset();
    listRevisions.mockResolvedValue([]);
    loadRevision.mockResolvedValue(null);
  });

  it("omits internal ids and raw conversation from reusable asset strings", async () => {
    graphMock.mockResolvedValue({
      nodes: [
        {
          nodeType: "Actor",
          title: "550e8400-e29b-41d4-a716-446655440000",
          summary: null,
          lifecycleStatus: "PROJECTED",
          projectionKey: "approved-candidate:x",
        },
        {
          nodeType: "Feature",
          title: "회의록 업로드",
          summary: "승인된 기능 요약",
          lifecycleStatus: "PROJECTED",
          projectionKey: "approved-candidate:y",
        },
        {
          nodeType: "ServiceFlow",
          title: "주문 처리",
          summary: null,
          lifecycleStatus: "PROJECTED",
        },
        {
          nodeType: "Actor",
          title: "고객",
          summary: null,
          lifecycleStatus: "CANDIDATE",
        },
      ],
      edges: [],
    });

    const candidate = await buildReferencePackageCandidate("p1");
    const blob = JSON.stringify(candidate);
    expect(blob).not.toMatch(/550e8400-e29b-41d4-a716-446655440000/);
    expect(blob).not.toMatch(/revisionId|eventId|nodeId|pipelineRunId/i);
    expect(candidate.reusableAssets.features).toContain("회의록 업로드");
    expect(candidate.reusableAssets.actors).not.toContain("550e8400-e29b-41d4-a716-446655440000");
  });
});
