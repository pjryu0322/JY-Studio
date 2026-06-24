import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getLatestMock = vi.fn();
const listMock = vi.fn();

vi.mock("@/lib/project-knowledge/projectKnowledgePipelineMonitor", () => ({
  getLatestKnowledgePipelineRun: (...args: unknown[]) => getLatestMock(...args),
  listKnowledgePipelineRuns: (...args: unknown[]) => listMock(...args),
}));

vi.mock("@/lib/auth/requireSession", () => ({
  requireSessionUserId: vi.fn().mockResolvedValue("user-1"),
}));

vi.mock("@/lib/service/taskOwnershipGuard", () => ({
  requireProjectPermissionById: vi.fn().mockResolvedValue(undefined),
}));

import { GET } from "@/app/api/projects/[projectId]/knowledge-pipeline/route";

describe("knowledgePipelineApi", () => {
  beforeEach(() => {
    getLatestMock.mockReset();
    listMock.mockReset();
    getLatestMock.mockResolvedValue({ id: "run-latest", projectId: "p1", status: "COMPLETED", steps: [] });
    listMock.mockResolvedValue([{ id: "run-latest", projectId: "p1", status: "COMPLETED", steps: [] }]);
  });

  it("returns latestRun and recentRuns", async () => {
    const req = new NextRequest("http://localhost/api/projects/p1/knowledge-pipeline?limit=20");
    const res = await GET(req, { params: Promise.resolve({ projectId: "p1" }) });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data?: { latestRun?: { id: string }; recentRuns?: unknown[] };
    };
    expect(json.data?.latestRun?.id).toBe("run-latest");
    expect(json.data?.recentRuns?.length).toBe(1);
    expect(listMock).toHaveBeenCalledWith("p1", 20);
  });
});
