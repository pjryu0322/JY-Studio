import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const buildTraceMock = vi.fn();

vi.mock("@/lib/project-knowledge/projectKnowledgeTraceService", () => ({
  buildKnowledgeTrace: (...args: unknown[]) => buildTraceMock(...args),
}));

vi.mock("@/lib/auth/requireSession", () => ({
  requireSessionUserId: vi.fn().mockResolvedValue("user-1"),
}));

vi.mock("@/lib/service/taskOwnershipGuard", () => ({
  requireProjectPermissionById: vi.fn().mockResolvedValue(undefined),
}));

import { GET } from "@/app/api/projects/[projectId]/knowledge-trace/[nodeId]/route";

describe("knowledgeTraceApi", () => {
  beforeEach(() => {
    buildTraceMock.mockReset();
    buildTraceMock.mockResolvedValue({
      nodeId: "node-1",
      lineage: [{ id: "s1", type: "graph-node", title: "[Node]", summary: "N" }],
      warnings: [],
    });
  });

  it("returns trace payload", async () => {
    const req = new NextRequest("http://localhost/api/projects/p1/knowledge-trace/node-1");
    const res = await GET(req, { params: Promise.resolve({ projectId: "p1", nodeId: "node-1" }) });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data?: { nodeId?: string; lineage?: unknown[] } };
    expect(json.data?.nodeId).toBe("node-1");
    expect(json.data?.lineage?.length).toBe(1);
    expect(buildTraceMock).toHaveBeenCalledWith("p1", "node-1");
  });

  it("rejects missing nodeId", async () => {
    const req = new NextRequest("http://localhost/api/projects/p1/knowledge-trace/");
    const res = await GET(req, { params: Promise.resolve({ projectId: "p1", nodeId: "" }) });
    expect(res.status).toBe(400);
  });
});
