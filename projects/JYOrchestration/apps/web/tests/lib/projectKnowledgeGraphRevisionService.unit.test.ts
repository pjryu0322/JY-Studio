import { describe, expect, it, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

const { findFirst, create, findMany, update } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectKnowledgeGraphRevision: {
      findFirst,
      create,
      findMany,
      update,
    },
  },
}));

vi.mock("@/lib/project-graph/projectGraphQuery", () => ({
  getProjectGraphSnapshot: vi.fn().mockResolvedValue({
    nodes: [
      {
        id: "n1",
        entityKey: "ek1",
        nodeType: "Feature",
        title: "기능 A",
        summary: "",
        metadata: {},
        projectionKey: "k1",
        sourceEventId: null,
      },
    ],
    edges: [],
  }),
}));

import {
  backfillKnowledgeGraphRevisionSnapshotPurpose,
  createKnowledgeGraphRevision,
  getLatestReferenceKnowledgeGraphRevision,
  listKnowledgeGraphRevisions,
  loadKnowledgeGraphRevision,
  loadLatestReferenceKnowledgeGraphRevision,
} from "@/lib/project-knowledge/projectKnowledgeGraphRevisionService";

describe("projectKnowledgeGraphRevisionService", () => {
  beforeEach(() => {
    findFirst.mockReset();
    create.mockReset();
    findMany.mockReset();
    update.mockReset();
  });

  it("createKnowledgeGraphRevision stores snapshotPurpose matching milestone purpose", async () => {
    findFirst.mockResolvedValue({ revisionNumber: 2 });
    create.mockResolvedValue({
      id: "rev-3",
      revisionNumber: 3,
      title: "추천안 승인",
      summary: "요약",
      nodeCount: 1,
      edgeCount: 0,
      createdAt: new Date("2026-06-24T10:10:00.000Z"),
    });

    const item = await createKnowledgeGraphRevision({
      projectId: "p1",
      milestone: "proposal_approval",
    });

    expect(item?.revisionNumber).toBe(3);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          snapshotPurpose: "REFERENCE_CANDIDATE",
        }),
      }),
    );
  });

  it("createKnowledgeGraphRevision retries on revisionNumber unique conflict", async () => {
    findFirst
      .mockResolvedValueOnce({ revisionNumber: 1 })
      .mockResolvedValueOnce({ revisionNumber: 2 });
    const uniqueError = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
    });
    create.mockRejectedValueOnce(uniqueError).mockResolvedValueOnce({
      id: "rev-3",
      revisionNumber: 3,
      title: "그래프 반영",
      summary: "요약",
      nodeCount: 1,
      edgeCount: 0,
      createdAt: new Date("2026-06-24T10:10:00.000Z"),
    });

    const item = await createKnowledgeGraphRevision({
      projectId: "p1",
      milestone: "graph_projection",
    });

    expect(item?.revisionNumber).toBe(3);
    expect(create).toHaveBeenCalledTimes(2);
    expect(findFirst).toHaveBeenCalledTimes(2);
  });

  it("listKnowledgeGraphRevisions returns ordered items", async () => {
    findMany.mockResolvedValue([
      {
        id: "r1",
        revisionNumber: 1,
        title: "대화 저장",
        summary: null,
        nodeCount: 0,
        edgeCount: 0,
        createdAt: new Date(),
      },
    ]);
    const list = await listKnowledgeGraphRevisions("p1");
    expect(list).toHaveLength(1);
    expect(list[0]?.title).toBe("대화 저장");
  });

  it("getLatestReferenceKnowledgeGraphRevision uses snapshotPurpose column", async () => {
    findFirst.mockResolvedValue({
      id: "ref-1",
      revisionNumber: 8,
      title: "추천안 승인",
      summary: null,
      nodeCount: 1,
      edgeCount: 0,
      createdAt: new Date(),
    });
    const ref = await getLatestReferenceKnowledgeGraphRevision("p1");
    expect(ref?.revisionNumber).toBe(8);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: "p1",
          snapshotPurpose: { in: ["REFERENCE_CANDIDATE", "REFERENCE_PACKAGE"] },
        }),
        orderBy: { revisionNumber: "desc" },
      }),
    );
  });

  it("getLatestReferenceKnowledgeGraphRevision returns null when no reference-purpose row", async () => {
    findFirst.mockResolvedValue(null);
    expect(await getLatestReferenceKnowledgeGraphRevision("p1")).toBeNull();
  });

  it("loadLatestReferenceKnowledgeGraphRevision loads reference revision detail", async () => {
    findFirst
      .mockResolvedValueOnce({
        id: "ref-1",
        revisionNumber: 5,
        title: "참조",
        summary: null,
        nodeCount: 1,
        edgeCount: 0,
        createdAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: "ref-1",
        revisionNumber: 5,
        title: "참조",
        summary: null,
        nodeCount: 1,
        edgeCount: 0,
        createdAt: new Date(),
        graphSnapshot: { purpose: "REFERENCE_CANDIDATE", nodes: [], edges: [] },
      });
    const detail = await loadLatestReferenceKnowledgeGraphRevision("p1");
    expect(detail?.graphSnapshot.purpose).toBe("REFERENCE_CANDIDATE");
  });

  it("backfillKnowledgeGraphRevisionSnapshotPurpose syncs column from JSON purpose", async () => {
    findMany.mockResolvedValue([
      {
        id: "r1",
        revisionNumber: 5,
        snapshotPurpose: "REPLAY",
        graphSnapshot: { purpose: "REFERENCE_CANDIDATE", nodes: [], edges: [] },
      },
    ]);
    update.mockResolvedValue({});
    const result = await backfillKnowledgeGraphRevisionSnapshotPurpose("p1");
    expect(result.scanned).toBe(1);
    expect(result.updated).toBe(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { snapshotPurpose: "REFERENCE_CANDIDATE" },
      }),
    );
  });

  it("backfillKnowledgeGraphRevisionSnapshotPurpose paginates when more than batchSize revisions", async () => {
    const batch1 = Array.from({ length: 2 }, (_, i) => ({
      id: `r${i + 1}`,
      revisionNumber: 10 - i,
      snapshotPurpose: "REPLAY",
      graphSnapshot: { purpose: "REPLAY", nodes: [], edges: [] },
    }));
    const batch2 = [
      {
        id: "r3",
        revisionNumber: 7,
        snapshotPurpose: "REPLAY",
        graphSnapshot: { purpose: "REFERENCE_CANDIDATE", nodes: [], edges: [] },
      },
    ];

    findMany.mockResolvedValueOnce(batch1).mockResolvedValueOnce(batch2);

    update.mockResolvedValue({});

    const result = await backfillKnowledgeGraphRevisionSnapshotPurpose("p1", {
      batchSize: 2,
      maxBatches: 10,
    });

    expect(result.scanned).toBe(3);
    expect(result.updated).toBe(1);
    expect(findMany).toHaveBeenCalledTimes(2);
    expect(findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: "p1",
          revisionNumber: { lt: 9 },
        }),
        take: 2,
      }),
    );
  });

  it("loadKnowledgeGraphRevision returns snapshot", async () => {
    findFirst.mockResolvedValue({
      id: "r1",
      revisionNumber: 1,
      title: "그래프 반영",
      summary: null,
      nodeCount: 1,
      edgeCount: 0,
      createdAt: new Date(),
      graphSnapshot: { nodes: [], edges: [] },
    });
    const detail = await loadKnowledgeGraphRevision("p1", "r1");
    expect(detail?.title).toBe("그래프 반영");
    expect(detail?.graphSnapshot.nodes).toEqual([]);
  });

  it("loadKnowledgeGraphRevision returns null when missing", async () => {
    findFirst.mockResolvedValue(null);
    expect(await loadKnowledgeGraphRevision("p1", "missing")).toBeNull();
  });
});
