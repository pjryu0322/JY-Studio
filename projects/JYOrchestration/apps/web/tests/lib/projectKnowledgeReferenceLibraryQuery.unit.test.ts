import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/service/projectService", () => ({
  listProjectsAccessibleToUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectKnowledgeGraphRevision: { findMany: vi.fn() },
  },
}));

import { listProjectsAccessibleToUser } from "@/lib/service/projectService";
import { prisma } from "@/lib/prisma";
import { listReferenceLibraryItems } from "@/lib/project-knowledge/projectKnowledgeReferenceLibraryQuery";

describe("listReferenceLibraryItems", () => {
  beforeEach(() => {
    vi.mocked(listProjectsAccessibleToUser).mockReset();
    vi.mocked(prisma.projectKnowledgeGraphRevision.findMany).mockReset();
  });

  it("returns snapshot-based items without live graph reads", async () => {
    vi.mocked(listProjectsAccessibleToUser).mockResolvedValue([
      {
        id: "p1",
        name: "주문 서비스",
        description: "설명",
        status: "ACTIVE",
      } as never,
    ]);

    vi.mocked(prisma.projectKnowledgeGraphRevision.findMany).mockResolvedValue([
      {
        id: "rev-ref",
        title: "추천안 승인",
        snapshotPurpose: "REFERENCE_CANDIDATE",
        createdAt: new Date("2026-06-20T10:00:00.000Z"),
        projectId: "p1",
        revisionNumber: 3,
        graphSnapshot: {
          purpose: "REFERENCE_CANDIDATE",
          nodes: [
            {
              entityKey: "a",
              nodeType: "Actor",
              title: "고객",
              summary: null,
              reference: {
                lifecycle: "USER_APPROVED",
                reusable: true,
                reusableAs: ["ACTOR"],
                safeForReference: true,
              },
            },
            {
              entityKey: "b",
              nodeType: "ServiceFlow",
              title: "주문",
              summary: null,
              reference: {
                lifecycle: "USER_APPROVED",
                reusable: true,
                reusableAs: ["SERVICE_FLOW"],
                safeForReference: true,
              },
            },
            {
              entityKey: "c",
              nodeType: "Feature",
              title: "결제",
              summary: null,
              reference: {
                lifecycle: "USER_APPROVED",
                reusable: true,
                reusableAs: ["FEATURE"],
                safeForReference: true,
              },
            },
          ],
          edges: [],
        },
        project: {
          name: "주문 서비스",
          description: "설명",
          updatedAt: new Date("2026-06-21T10:00:00.000Z"),
        },
      },
    ] as never);

    const items = await listReferenceLibraryItems({ userId: "u1" });
    expect(items).toHaveLength(1);
    expect(items[0]?.referenceSnapshotId).toBe("rev-ref");
    expect(items[0]?.readiness).toBe("READY");
    expect(items[0]?.counts.reusableGraphNodes).toBe(3);
  });

  it("queries reference-purpose revisions only", async () => {
    vi.mocked(listProjectsAccessibleToUser).mockResolvedValue([
      { id: "p1", name: "P", description: null, status: "ACTIVE" } as never,
    ]);
    vi.mocked(prisma.projectKnowledgeGraphRevision.findMany).mockResolvedValue([] as never);
    await listReferenceLibraryItems({ userId: "u1" });
    expect(prisma.projectKnowledgeGraphRevision.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          snapshotPurpose: { in: ["REFERENCE_CANDIDATE", "REFERENCE_PACKAGE"] },
        }),
      }),
    );
  });
});
