import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ProjectAccessDeniedError } from "@/lib/rbac/projectAccessDenied";

const sessionMock = vi.fn();
const permissionMock = vi.fn();
const previewMock = vi.fn();

vi.mock("@/lib/auth/requireSession", () => ({
  requireSessionUserId: (...args: unknown[]) => sessionMock(...args),
}));

vi.mock("@/lib/service/taskOwnershipGuard", () => ({
  requireProjectPermissionById: (...args: unknown[]) => permissionMock(...args),
}));

vi.mock("@/lib/project-knowledge/projectKnowledgeUserMemoryControlProjectPersistence", () => ({
  loadUserProjectKnowledgeMemoryControlForProject: vi.fn().mockResolvedValue({
    version: "user_project_knowledge_memory_control_v1",
    enabled: true,
    excludedSourceProjectIds: [],
    ignoredMemoryItemIds: [],
    pinnedMemoryItemIds: [],
  }),
}));

vi.mock("@/lib/project-knowledge/projectKnowledgeUserMemoryPreviewService", () => ({
  buildUserProjectKnowledgeMemoryPreview: (...args: unknown[]) => previewMock(...args),
}));

import { GET } from "@/app/api/project-knowledge/user-memory-preview/route";

describe("projectKnowledgeUserMemoryPreviewRoute", () => {
  beforeEach(() => {
    sessionMock.mockReset();
    permissionMock.mockReset();
    previewMock.mockReset();
    sessionMock.mockResolvedValue("user-1");
    permissionMock.mockResolvedValue(undefined);
    previewMock.mockResolvedValue({
      enabled: true,
      sourceProjectCount: 1,
      totalItemCount: 1,
      byAgent: {
        planner: {
          enabled: true,
          itemCount: 1,
          items: [
            {
              actionId: "mem_abc123",
              sourceProjectActionId: "src_def456",
              title: "T",
              promptSummary: "S",
              useAs: "mvp_scope",
              relevance: 0.8,
              lifecycle: "AUTO_CAPTURED",
              pinned: false,
              ignored: false,
              agent: "planner",
              nodeType: "Feature",
              sourceProjectTitle: "Old project",
            },
          ],
        },
        analyst: { enabled: true, itemCount: 0, items: [] },
        developer: { enabled: true, itemCount: 0, items: [] },
        reviewer: { enabled: true, itemCount: 0, items: [] },
        security: { enabled: true, itemCount: 0, items: [] },
      },
    });
  });

  it("returns 400 without projectId", async () => {
    const res = await GET(new NextRequest("http://localhost/api/project-knowledge/user-memory-preview"));
    expect(res.status).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    sessionMock.mockResolvedValue(
      NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 }),
    );
    const res = await GET(
      new NextRequest("http://localhost/api/project-knowledge/user-memory-preview?projectId=p1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 without canViewProject", async () => {
    permissionMock.mockRejectedValue(new ProjectAccessDeniedError("denied"));
    const res = await GET(
      new NextRequest("http://localhost/api/project-knowledge/user-memory-preview?projectId=p1"),
    );
    expect(res.status).toBe(403);
  });

  it("returns success preview without raw ids in JSON", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/project-knowledge/user-memory-preview?projectId=p1"),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('"success":true');
    expect(text).not.toContain("sourceProjectId");
    expect(text).not.toContain("sourceNodeId");
    expect(text).not.toContain("displayId");
    expect(text).toContain("mem_abc123");
  });
});
