import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ProjectAccessDeniedError } from "@/lib/rbac/projectAccessDenied";

const sessionMock = vi.fn();
const permissionMock = vi.fn();
const staleMock = vi.fn();

vi.mock("@/lib/auth/requireSession", () => ({
  requireSessionUserId: (...args: unknown[]) => sessionMock(...args),
}));

vi.mock("@/lib/service/taskOwnershipGuard", () => ({
  requireProjectPermissionById: (...args: unknown[]) => permissionMock(...args),
}));

vi.mock("@/lib/project-knowledge/projectKnowledgeUserMemoryStaleService", () => ({
  buildUserProjectKnowledgeMemoryStalePreview: (...args: unknown[]) => staleMock(...args),
}));

import { GET } from "@/app/api/project-knowledge/user-memory-stale-preview/route";

describe("projectKnowledgeUserMemoryStalePreviewRoute", () => {
  beforeEach(() => {
    sessionMock.mockReset();
    permissionMock.mockReset();
    staleMock.mockReset();
    sessionMock.mockResolvedValue("user-1");
    permissionMock.mockResolvedValue(undefined);
    staleMock.mockResolvedValue({
      version: "user_project_knowledge_memory_stale_state_v1",
      candidateCount: 1,
      candidates: [
        {
          actionId: "opaque-stale-1",
          agent: "planner",
          title: "Stale title",
          promptSummary: "Stale summary",
          reasons: ["low_relevance"],
          relevance: 0.2,
          ignored: false,
          pinned: false,
        },
      ],
    });
  });

  it("returns 400 without projectId", async () => {
    const res = await GET(new NextRequest("http://localhost/api/project-knowledge/user-memory-stale-preview"));
    expect(res.status).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    sessionMock.mockResolvedValue(
      NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 }),
    );
    const res = await GET(
      new NextRequest("http://localhost/api/project-knowledge/user-memory-stale-preview?projectId=p1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 without permission", async () => {
    permissionMock.mockRejectedValue(new ProjectAccessDeniedError("denied"));
    const res = await GET(
      new NextRequest("http://localhost/api/project-knowledge/user-memory-stale-preview?projectId=p1"),
    );
    expect(res.status).toBe(403);
  });

  it("returns stale preview without raw ids", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/project-knowledge/user-memory-stale-preview?projectId=p1"),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("sourceProjectId");
    expect(text).not.toContain("sourceNodeId");
    expect(text).toContain("opaque-stale-1");
  });
});
