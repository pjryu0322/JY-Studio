import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ProjectAccessDeniedError } from "@/lib/rbac/projectAccessDenied";

const sessionMock = vi.fn();
const permissionMock = vi.fn();
const loadStateMock = vi.fn();

vi.mock("@/lib/auth/requireSession", () => ({
  requireSessionUserId: (...args: unknown[]) => sessionMock(...args),
}));

vi.mock("@/lib/service/taskOwnershipGuard", () => ({
  requireProjectPermissionById: (...args: unknown[]) => permissionMock(...args),
}));

vi.mock("@/lib/project-knowledge/projectKnowledgeUserMemoryUsagePersistence", () => ({
  loadUserProjectKnowledgeMemoryUsageStateForProject: (...args: unknown[]) => loadStateMock(...args),
}));

import { GET } from "@/app/api/project-knowledge/user-memory-usage/route";

describe("projectKnowledgeUserMemoryUsageRoute", () => {
  beforeEach(() => {
    sessionMock.mockReset();
    permissionMock.mockReset();
    loadStateMock.mockReset();
    sessionMock.mockResolvedValue("user-1");
    permissionMock.mockResolvedValue(undefined);
    loadStateMock.mockResolvedValue({
      version: "user_project_knowledge_memory_usage_state_v1",
      events: [
        {
          version: "user_project_knowledge_memory_usage_event_v1",
          id: "e1",
          at: "2026-06-03T00:00:00.000Z",
          projectId: "p1",
          surface: "single_chat",
          agent: "planner",
          outcome: "injected",
          itemCount: 2,
          sourceProjectCount: 1,
          controlEnabled: true,
          agentEnabled: true,
          promptSectionHash: "abc123",
        },
      ],
    });
  });

  it("returns 400 without projectId", async () => {
    const res = await GET(new NextRequest("http://localhost/api/project-knowledge/user-memory-usage"));
    expect(res.status).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    sessionMock.mockResolvedValue(
      NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 }),
    );
    const res = await GET(
      new NextRequest("http://localhost/api/project-knowledge/user-memory-usage?projectId=p1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 without permission", async () => {
    permissionMock.mockRejectedValue(new ProjectAccessDeniedError("denied"));
    const res = await GET(
      new NextRequest("http://localhost/api/project-knowledge/user-memory-usage?projectId=p1"),
    );
    expect(res.status).toBe(403);
  });

  it("returns summary without raw ids", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/project-knowledge/user-memory-usage?projectId=p1"),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('"success":true');
    expect(text).not.toContain("sourceProjectId");
    expect(text).not.toContain("sourceNodeId");
    const json = JSON.parse(text) as { summary: { injectedEvents: number } };
    expect(json.summary.injectedEvents).toBe(1);
  });
});
