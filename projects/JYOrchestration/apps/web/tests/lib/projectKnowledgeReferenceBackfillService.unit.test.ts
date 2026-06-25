import { describe, expect, it, vi, beforeEach } from "vitest";

const { findMany, update, candidateFindMany } = vi.hoisted(() => ({
  findMany: vi.fn(),
  update: vi.fn(),
  candidateFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectGraphNode: { findMany, update },
    projectStructureCandidate: { findMany: candidateFindMany },
    projectKnowledgeGraphRevision: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/project-knowledge/projectKnowledgeGraphRevisionService", () => ({
  backfillKnowledgeGraphRevisionSnapshotPurpose: vi.fn().mockResolvedValue({ scanned: 0, updated: 0 }),
}));

import { backfillProjectGraphNodeReferenceMetadata } from "@/lib/project-knowledge/projectKnowledgeReferenceBackfillService";

describe("backfillProjectGraphNodeReferenceMetadata", () => {
  beforeEach(() => {
    findMany.mockReset();
    update.mockReset();
    candidateFindMany.mockReset();
  });

  it("adds reference metadata when missing and preserves other metadata", async () => {
    findMany.mockResolvedValue([
      {
        id: "n1",
        nodeType: "Feature",
        title: "기능 A",
        summary: "요약",
        projectionKey: "approved-candidate:c1:node",
        sourceEventId: "ev-1",
        metadata: { structureCandidateId: "c1", approved: true },
      },
    ]);
    candidateFindMany.mockResolvedValue([{ id: "c1", lifecycleStatus: "APPROVED" }]);
    update.mockResolvedValue({});

    const result = await backfillProjectGraphNodeReferenceMetadata("p1");
    expect(result).toEqual({ scanned: 1, updated: 1 });
    expect(candidateFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: ["c1"] } }) }),
    );
    expect(update).toHaveBeenCalled();
  });

  it("skips nodes that already have metadata.reference", async () => {
    findMany.mockResolvedValue([
      {
        id: "n2",
        nodeType: "Feature",
        title: "기능 B",
        summary: null,
        projectionKey: "k",
        sourceEventId: null,
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
      },
    ]);

    const result = await backfillProjectGraphNodeReferenceMetadata("p1");
    expect(result).toEqual({ scanned: 1, updated: 0 });
    expect(update).not.toHaveBeenCalled();
  });

  it("marks sensitive nodes as not safe for reference", async () => {
    findMany.mockResolvedValue([
      {
        id: "n3",
        nodeType: "Feature",
        title: "api_key=secret",
        summary: null,
        projectionKey: "k",
        sourceEventId: null,
        metadata: {},
      },
    ]);
    candidateFindMany.mockResolvedValue([]);
    update.mockResolvedValue({});

    await backfillProjectGraphNodeReferenceMetadata("p1");
    const call = update.mock.calls[0]?.[0] as {
      data: { metadata: { reference: { reusable: boolean; sensitivity: { safeForReference: boolean } } } };
    };
    expect(call.data.metadata.reference.reusable).toBe(false);
    expect(call.data.metadata.reference.sensitivity.safeForReference).toBe(false);
  });

  it("respects limitNodes", async () => {
    findMany.mockResolvedValue([]);
    await backfillProjectGraphNodeReferenceMetadata("p1", { limitNodes: 10 });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
  });
});
