import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const backfillMock = vi.fn();

vi.mock("@/lib/project-knowledge/projectKnowledgeReferenceBackfillService", () => ({
  runProjectReferenceBackfill: (...args: unknown[]) => backfillMock(...args),
}));

vi.mock("@/lib/auth/requireSession", () => ({
  requireSessionUserId: vi.fn().mockResolvedValue("user-1"),
}));

vi.mock("@/lib/service/taskOwnershipGuard", () => ({
  requireProjectPermissionById: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/projects/[projectId]/knowledge/reference/backfill/route";

describe("knowledgeReferenceBackfillApi", () => {
  beforeEach(() => {
    backfillMock.mockReset();
  });

  it("returns scanned and updated counts without internal ids", async () => {
    backfillMock.mockResolvedValue({
      graphNodes: { scanned: 5, updated: 2 },
      revisions: { scanned: 3, updated: 1 },
    });
    const req = new NextRequest("http://localhost/api/projects/p1/knowledge/reference/backfill", {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ projectId: "p1" }) });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data?: Record<string, number>; message?: string };
    expect(json.data?.graphNodesScanned).toBe(5);
    expect(json.data?.graphNodesUpdated).toBe(2);
    expect(JSON.stringify(json)).not.toMatch(/revisionId|eventId|nodeId/i);
  });

  it("rejects missing projectId", async () => {
    const req = new NextRequest("http://localhost/api/projects//knowledge/reference/backfill", {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ projectId: "" }) });
    expect(res.status).toBe(400);
  });
});
