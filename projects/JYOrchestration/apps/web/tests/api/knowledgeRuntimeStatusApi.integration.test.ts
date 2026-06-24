import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const statusMock = vi.fn();

vi.mock("@/lib/project-knowledge/projectKnowledgeRuntimeStatusService", () => ({
  getKnowledgeRuntimeStatusSummary: (...args: unknown[]) => statusMock(...args),
}));

vi.mock("@/lib/auth/requireSession", () => ({
  requireSessionUserId: vi.fn().mockResolvedValue("user-1"),
}));

vi.mock("@/lib/service/taskOwnershipGuard", () => ({
  requireProjectPermissionById: vi.fn().mockResolvedValue(undefined),
}));

import { GET } from "@/app/api/projects/[projectId]/knowledge-runtime/status/route";

describe("knowledgeRuntimeStatusApi", () => {
  beforeEach(() => {
    statusMock.mockReset();
  });

  it("returns status summary", async () => {
    statusMock.mockResolvedValue({
      status: "READY",
      statusLabel: "구조화 완료",
      nodeCount: 5,
      edgeCount: 4,
      latestChangeTitle: "대화 저장",
      latestChangedAt: "2026-06-24T10:00:00.000Z",
    });
    const req = new NextRequest("http://localhost/api/projects/p1/knowledge-runtime/status");
    const res = await GET(req, { params: Promise.resolve({ projectId: "p1" }) });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data?: { statusLabel?: string } };
    expect(json.data?.statusLabel).toBe("구조화 완료");
    expect(statusMock).toHaveBeenCalledWith("p1");
  });

  it("rejects missing projectId", async () => {
    const req = new NextRequest("http://localhost/api/projects//knowledge-runtime/status");
    const res = await GET(req, { params: Promise.resolve({ projectId: "" }) });
    expect(res.status).toBe(400);
  });
});
