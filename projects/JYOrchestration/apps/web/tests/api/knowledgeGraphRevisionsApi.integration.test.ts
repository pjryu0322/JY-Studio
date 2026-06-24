import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const listMock = vi.fn();
const loadMock = vi.fn();

vi.mock("@/lib/project-knowledge/projectKnowledgeGraphRevisionService", () => ({
  listKnowledgeGraphRevisions: (...args: unknown[]) => listMock(...args),
  loadKnowledgeGraphRevision: (...args: unknown[]) => loadMock(...args),
}));

vi.mock("@/lib/auth/requireSession", () => ({
  requireSessionUserId: vi.fn().mockResolvedValue("user-1"),
}));

vi.mock("@/lib/service/taskOwnershipGuard", () => ({
  requireProjectPermissionById: vi.fn().mockResolvedValue(undefined),
}));

import { GET as listGET } from "@/app/api/projects/[projectId]/knowledge-graph/revisions/route";
import { GET as detailGET } from "@/app/api/projects/[projectId]/knowledge-graph/revisions/[revisionId]/route";

describe("knowledgeGraphRevisionsApi", () => {
  beforeEach(() => {
    listMock.mockReset();
    loadMock.mockReset();
  });

  it("lists revisions", async () => {
    listMock.mockResolvedValue([
      {
        id: "r1",
        revisionNumber: 1,
        title: "대화 저장",
        summary: null,
        nodeCount: 0,
        edgeCount: 0,
        createdAt: "2026-06-24T10:10:00.000Z",
      },
    ]);
    const req = new NextRequest("http://localhost/api/projects/p1/knowledge-graph/revisions");
    const res = await listGET(req, { params: Promise.resolve({ projectId: "p1" }) });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data?: { revisions?: unknown[] } };
    expect(json.data?.revisions).toHaveLength(1);
  });

  it("loads revision detail", async () => {
    loadMock.mockResolvedValue({
      id: "r1",
      revisionNumber: 1,
      title: "그래프 반영",
      summary: null,
      nodeCount: 1,
      edgeCount: 0,
      createdAt: "2026-06-24T10:13:00.000Z",
      graphSnapshot: { nodes: [], edges: [] },
    });
    const req = new NextRequest("http://localhost/api/projects/p1/knowledge-graph/revisions/r1");
    const res = await detailGET(req, { params: Promise.resolve({ projectId: "p1", revisionId: "r1" }) });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data?: { revision?: { title?: string } } };
    expect(json.data?.revision?.title).toBe("그래프 반영");
  });

  it("returns 404 when revision missing", async () => {
    loadMock.mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/projects/p1/knowledge-graph/revisions/x");
    const res = await detailGET(req, { params: Promise.resolve({ projectId: "p1", revisionId: "x" }) });
    expect(res.status).toBe(404);
  });

  it("rejects missing projectId on list route", async () => {
    const req = new NextRequest("http://localhost/api/projects//knowledge-graph/revisions");
    const res = await listGET(req, { params: Promise.resolve({ projectId: "" }) });
    expect(res.status).toBe(400);
  });
});
