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

const eligibleGraphSnapshot = (purpose: "REFERENCE_CANDIDATE" | "REFERENCE_PACKAGE") => ({
  purpose,
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
});

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

  it("returns package revision when latest revision is candidate (purpose=package)", async () => {
    vi.mocked(listProjectsAccessibleToUser).mockResolvedValue([
      { id: "p1", name: "P", description: null, status: "ACTIVE" } as never,
    ]);
    vi.mocked(prisma.projectKnowledgeGraphRevision.findMany).mockResolvedValue([
      {
        id: "rev-cand",
        title: "최신 후보",
        snapshotPurpose: "REFERENCE_CANDIDATE",
        createdAt: new Date("2026-06-22T10:00:00.000Z"),
        projectId: "p1",
        revisionNumber: 3,
        graphSnapshot: eligibleGraphSnapshot("REFERENCE_CANDIDATE"),
        project: { name: "P", description: null, updatedAt: new Date("2026-06-22T10:00:00.000Z") },
      },
      {
        id: "rev-pkg",
        title: "패키지 저장본",
        snapshotPurpose: "REFERENCE_PACKAGE",
        createdAt: new Date("2026-06-20T10:00:00.000Z"),
        projectId: "p1",
        revisionNumber: 2,
        graphSnapshot: eligibleGraphSnapshot("REFERENCE_PACKAGE"),
        project: { name: "P", description: null, updatedAt: new Date("2026-06-20T10:00:00.000Z") },
      },
    ] as never);

    const items = await listReferenceLibraryItems({ userId: "u1", purpose: "package" });
    expect(items).toHaveLength(1);
    expect(items[0]?.referenceSnapshotId).toBe("rev-pkg");
    expect(items[0]?.snapshotPurpose).toBe("REFERENCE_PACKAGE");
  });

  it("returns candidate revision when latest revision is package (purpose=candidate)", async () => {
    vi.mocked(listProjectsAccessibleToUser).mockResolvedValue([
      { id: "p1", name: "P", description: null, status: "ACTIVE" } as never,
    ]);
    vi.mocked(prisma.projectKnowledgeGraphRevision.findMany).mockResolvedValue([
      {
        id: "rev-pkg",
        title: "패키지",
        snapshotPurpose: "REFERENCE_PACKAGE",
        createdAt: new Date("2026-06-22T10:00:00.000Z"),
        projectId: "p1",
        revisionNumber: 3,
        graphSnapshot: eligibleGraphSnapshot("REFERENCE_PACKAGE"),
        project: { name: "P", description: null, updatedAt: new Date("2026-06-22T10:00:00.000Z") },
      },
      {
        id: "rev-cand",
        title: "후보",
        snapshotPurpose: "REFERENCE_CANDIDATE",
        createdAt: new Date("2026-06-20T10:00:00.000Z"),
        projectId: "p1",
        revisionNumber: 2,
        graphSnapshot: eligibleGraphSnapshot("REFERENCE_CANDIDATE"),
        project: { name: "P", description: null, updatedAt: new Date("2026-06-20T10:00:00.000Z") },
      },
    ] as never);

    const items = await listReferenceLibraryItems({ userId: "u1", purpose: "candidate" });
    expect(items).toHaveLength(1);
    expect(items[0]?.referenceSnapshotId).toBe("rev-cand");
  });

  it("matches q against older revision when latest does not match", async () => {
    vi.mocked(listProjectsAccessibleToUser).mockResolvedValue([
      { id: "p1", name: "Alpha", description: "desc", status: "ACTIVE" } as never,
    ]);
    vi.mocked(prisma.projectKnowledgeGraphRevision.findMany).mockResolvedValue([
      {
        id: "rev-new",
        title: "최신 일반",
        snapshotPurpose: "REFERENCE_CANDIDATE",
        createdAt: new Date("2026-06-22T10:00:00.000Z"),
        projectId: "p1",
        revisionNumber: 3,
        graphSnapshot: {
          ...eligibleGraphSnapshot("REFERENCE_CANDIDATE"),
          nodes: eligibleGraphSnapshot("REFERENCE_CANDIDATE").nodes.map((n) =>
            n.entityKey === "a" ? { ...n, title: "일반액터" } : n,
          ),
        },
        project: { name: "Alpha", description: "desc", updatedAt: new Date("2026-06-22T10:00:00.000Z") },
      },
      {
        id: "rev-old",
        title: "유니크검색키워드",
        snapshotPurpose: "REFERENCE_CANDIDATE",
        createdAt: new Date("2026-06-18T10:00:00.000Z"),
        projectId: "p1",
        revisionNumber: 2,
        graphSnapshot: eligibleGraphSnapshot("REFERENCE_CANDIDATE"),
        project: { name: "Alpha", description: "desc", updatedAt: new Date("2026-06-18T10:00:00.000Z") },
      },
    ] as never);

    const items = await listReferenceLibraryItems({ userId: "u1", q: "유니크검색키워드" });
    expect(items).toHaveLength(1);
    expect(items[0]?.referenceSnapshotId).toBe("rev-old");
  });

  it("returns at most one item per project after filters", async () => {
    vi.mocked(listProjectsAccessibleToUser).mockResolvedValue([
      { id: "p1", name: "P1", description: null, status: "ACTIVE" } as never,
      { id: "p2", name: "P2", description: null, status: "ACTIVE" } as never,
    ]);
    vi.mocked(prisma.projectKnowledgeGraphRevision.findMany).mockResolvedValue([
      {
        id: "p1-r3",
        title: "P1 latest",
        snapshotPurpose: "REFERENCE_CANDIDATE",
        createdAt: new Date("2026-06-22T10:00:00.000Z"),
        projectId: "p1",
        revisionNumber: 3,
        graphSnapshot: eligibleGraphSnapshot("REFERENCE_CANDIDATE"),
        project: { name: "P1", description: null, updatedAt: new Date("2026-06-22T10:00:00.000Z") },
      },
      {
        id: "p1-r2",
        title: "P1 older",
        snapshotPurpose: "REFERENCE_CANDIDATE",
        createdAt: new Date("2026-06-20T10:00:00.000Z"),
        projectId: "p1",
        revisionNumber: 2,
        graphSnapshot: eligibleGraphSnapshot("REFERENCE_CANDIDATE"),
        project: { name: "P1", description: null, updatedAt: new Date("2026-06-20T10:00:00.000Z") },
      },
      {
        id: "p2-r1",
        title: "P2",
        snapshotPurpose: "REFERENCE_CANDIDATE",
        createdAt: new Date("2026-06-21T10:00:00.000Z"),
        projectId: "p2",
        revisionNumber: 1,
        graphSnapshot: eligibleGraphSnapshot("REFERENCE_CANDIDATE"),
        project: { name: "P2", description: null, updatedAt: new Date("2026-06-21T10:00:00.000Z") },
      },
    ] as never);

    const items = await listReferenceLibraryItems({ userId: "u1" });
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.projectId).sort()).toEqual(["p1", "p2"]);
    expect(items.find((i) => i.projectId === "p1")?.referenceSnapshotId).toBe("p1-r3");
  });
});
