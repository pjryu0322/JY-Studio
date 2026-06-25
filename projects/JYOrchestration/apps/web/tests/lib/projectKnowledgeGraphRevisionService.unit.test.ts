import { describe, expect, it, vi, beforeEach } from "vitest";

const { findFirst, create, findMany } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectKnowledgeGraphRevision: {
      findFirst,
      create,
      findMany,
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
      },
    ],
    edges: [],
  }),
}));

import {
  createKnowledgeGraphRevision,
  getLatestKnowledgeGraphRevision,
  listKnowledgeGraphRevisions,
  loadKnowledgeGraphRevision,
} from "@/lib/project-knowledge/projectKnowledgeGraphRevisionService";

describe("projectKnowledgeGraphRevisionService", () => {
  beforeEach(() => {
    findFirst.mockReset();
    create.mockReset();
    findMany.mockReset();
  });

  it("createKnowledgeGraphRevision increments revision number", async () => {
    findFirst.mockResolvedValue({ revisionNumber: 2 });
    create.mockResolvedValue({
      id: "rev-3",
      revisionNumber: 3,
      title: "대화 저장",
      summary: "요약",
      nodeCount: 1,
      edgeCount: 0,
      createdAt: new Date("2026-06-24T10:10:00.000Z"),
    });

    const item = await createKnowledgeGraphRevision({
      projectId: "p1",
      milestone: "conversation_sync",
    });

    expect(item?.revisionNumber).toBe(3);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "p1",
          revisionNumber: 3,
          title: "대화 저장",
        }),
      }),
    );
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

  it("getLatestKnowledgeGraphRevision uses desc order", async () => {
    findFirst.mockResolvedValue({
      id: "r60",
      revisionNumber: 60,
      title: "최신",
      summary: null,
      nodeCount: 1,
      edgeCount: 0,
      createdAt: new Date("2026-06-25T00:00:00.000Z"),
    });
    const latest = await getLatestKnowledgeGraphRevision("p1");
    expect(latest?.revisionNumber).toBe(60);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: "p1" },
        orderBy: { revisionNumber: "desc" },
      }),
    );
  });

  it("loadKnowledgeGraphRevision returns null when missing", async () => {
    findFirst.mockResolvedValue(null);
    expect(await loadKnowledgeGraphRevision("p1", "missing")).toBeNull();
  });
});
