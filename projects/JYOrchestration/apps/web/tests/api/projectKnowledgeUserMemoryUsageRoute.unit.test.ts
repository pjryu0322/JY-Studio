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
          projectId: "project-secret",
          userIdHash: "user-secret",
          surface: "codetask_prompt",
          agent: "developer",
          outcome: "injected",
          itemCount: 2,
          sourceProjectCount: 1,
          controlEnabled: true,
          agentEnabled: true,
          promptSectionHash: "prompt-secret",
          promptTimelineEntryId: "timeline-secret",
          codeTaskId: "codetask-secret",
          runId: "run-secret",
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
    expect(text).not.toContain("project-secret");
    expect(text).not.toContain("user-secret");
    expect(text).not.toContain("timeline-secret");
    expect(text).not.toContain("codetask-secret");
    expect(text).not.toContain("run-secret");
    expect(text).not.toContain("prompt-secret");
    const json = JSON.parse(text) as { summary: { injectedEvents: number; recentEvents: unknown[] } };
    expect(json.summary.injectedEvents).toBe(1);
    expect(JSON.stringify(json.summary.recentEvents[0] ?? {})).not.toContain("e1");
  });
});
