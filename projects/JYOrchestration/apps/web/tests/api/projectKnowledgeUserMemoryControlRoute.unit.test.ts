import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ProjectAccessDeniedError } from "@/lib/rbac/projectAccessDenied";

const sessionMock = vi.fn();
const permissionMock = vi.fn();
const loadControlMock = vi.fn();
const patchControlMock = vi.fn();

vi.mock("@/lib/auth/requireSession", () => ({
  requireSessionUserId: (...args: unknown[]) => sessionMock(...args),
}));

vi.mock("@/lib/service/taskOwnershipGuard", () => ({
  requireProjectPermissionById: (...args: unknown[]) => permissionMock(...args),
}));

vi.mock("@/lib/project-knowledge/projectKnowledgeUserMemoryControlProjectPersistence", () => ({
  loadUserProjectKnowledgeMemoryControlForProject: (...args: unknown[]) => loadControlMock(...args),
  patchUserProjectKnowledgeMemoryControlForProject: (...args: unknown[]) => patchControlMock(...args),
}));

import { GET, PATCH } from "@/app/api/project-knowledge/user-memory-control/route";

describe("projectKnowledgeUserMemoryControlRoute", () => {
  beforeEach(() => {
    sessionMock.mockReset();
    permissionMock.mockReset();
    loadControlMock.mockReset();
    patchControlMock.mockReset();
    sessionMock.mockResolvedValue("user-1");
    permissionMock.mockResolvedValue(undefined);
    loadControlMock.mockResolvedValue({
      version: "user_project_knowledge_memory_control_v1",
      enabled: true,
      excludedSourceProjectIds: [],
      ignoredMemoryItemIds: [],
      pinnedMemoryItemIds: [],
    });
    patchControlMock.mockResolvedValue({
      version: "user_project_knowledge_memory_control_v1",
      enabled: false,
      excludedSourceProjectIds: [],
      ignoredMemoryItemIds: [],
      pinnedMemoryItemIds: [],
      updatedAt: "2026-06-03T00:00:00.000Z",
    });
  });

  it("GET requires projectId", async () => {
    const req = new NextRequest("http://localhost/api/project-knowledge/user-memory-control");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("GET returns control for authorized user", async () => {
    const req = new NextRequest(
      "http://localhost/api/project-knowledge/user-memory-control?projectId=p1",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.control.enabled).toBe(true);
    expect(loadControlMock).toHaveBeenCalledWith("p1");
  });

  it("PATCH rejects without canEditProject", async () => {
    permissionMock.mockRejectedValue(new ProjectAccessDeniedError("denied"));
    const req = new NextRequest("http://localhost/api/project-knowledge/user-memory-control", {
      method: "PATCH",
      body: JSON.stringify({ projectId: "p1", patch: { enabled: false } }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(403);
  });

  it("PATCH merges control", async () => {
    const req = new NextRequest("http://localhost/api/project-knowledge/user-memory-control", {
      method: "PATCH",
      body: JSON.stringify({ projectId: "p1", patch: { enabled: false } }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.control.enabled).toBe(false);
    expect(patchControlMock).toHaveBeenCalled();
  });

  it("GET rejects unauthenticated", async () => {
    sessionMock.mockResolvedValue(
      NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 }),
    );
    const req = new NextRequest(
      "http://localhost/api/project-knowledge/user-memory-control?projectId=p1",
    );
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
