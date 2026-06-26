import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ProjectAccessDeniedError } from "@/lib/rbac/projectAccessDenied";

const sessionMock = vi.fn();
const permissionMock = vi.fn();
const loadControlMock = vi.fn();
const patchControlMock = vi.fn();
const applyActionMock = vi.fn();

const { UserMemoryControlActionNotFoundError } = vi.hoisted(() => {
  class UserMemoryControlActionNotFoundError extends Error {
    constructor() {
      super("알 수 없는 memory action입니다.");
      this.name = "UserMemoryControlActionNotFoundError";
    }
  }
  return { UserMemoryControlActionNotFoundError };
});

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

vi.mock("@/lib/project-knowledge/projectKnowledgeUserMemoryControlActionService", () => ({
  applyUserMemoryControlActionToPatch: (...args: unknown[]) => applyActionMock(...args),
  UserMemoryControlActionNotFoundError,
}));

import { GET, PATCH } from "@/app/api/project-knowledge/user-memory-control/route";

const baseControl = {
  version: "user_project_knowledge_memory_control_v1" as const,
  enabled: true,
  excludedSourceProjectIds: [] as string[],
  ignoredMemoryItemIds: [] as string[],
  pinnedMemoryItemIds: [] as string[],
};

describe("projectKnowledgeUserMemoryControlRoute", () => {
  beforeEach(() => {
    sessionMock.mockReset();
    permissionMock.mockReset();
    loadControlMock.mockReset();
    patchControlMock.mockReset();
    applyActionMock.mockReset();
    sessionMock.mockResolvedValue("user-1");
    permissionMock.mockResolvedValue(undefined);
    loadControlMock.mockResolvedValue(baseControl);
    patchControlMock.mockResolvedValue({ ...baseControl, enabled: false });
    applyActionMock.mockResolvedValue({ enabled: false });
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
  });

  it("PATCH SET_ENABLED action", async () => {
    const req = new NextRequest("http://localhost/api/project-knowledge/user-memory-control", {
      method: "PATCH",
      body: JSON.stringify({ projectId: "p1", action: { type: "SET_ENABLED", enabled: false } }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect(applyActionMock).toHaveBeenCalled();
    expect(patchControlMock).toHaveBeenCalled();
  });

  it("PATCH PIN_MEMORY_ITEM calls action resolver path", async () => {
    applyActionMock.mockResolvedValue({ pinnedMemoryItemIds: ["raw-id"] });
    const req = new NextRequest("http://localhost/api/project-knowledge/user-memory-control", {
      method: "PATCH",
      body: JSON.stringify({
        projectId: "p1",
        action: { type: "PIN_MEMORY_ITEM", actionId: "mem_abc" },
      }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect(applyActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: { type: "PIN_MEMORY_ITEM", actionId: "mem_abc" },
      }),
    );
  });

  it("PATCH UNIGNORE_MEMORY_ITEM", async () => {
    applyActionMock.mockResolvedValue({ ignoredMemoryItemIds: [] });
    const req = new NextRequest("http://localhost/api/project-knowledge/user-memory-control", {
      method: "PATCH",
      body: JSON.stringify({
        projectId: "p1",
        action: { type: "UNIGNORE_MEMORY_ITEM", actionId: "mem_xyz" },
      }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect(applyActionMock).toHaveBeenCalled();
  });

  it("PATCH invalid actionId returns 404", async () => {
    applyActionMock.mockRejectedValue(new UserMemoryControlActionNotFoundError());
    const req = new NextRequest("http://localhost/api/project-knowledge/user-memory-control", {
      method: "PATCH",
      body: JSON.stringify({
        projectId: "p1",
        action: { type: "IGNORE_MEMORY_ITEM", actionId: "mem_bad" },
      }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(404);
  });

  it("PATCH legacy patch body still works", async () => {
    const req = new NextRequest("http://localhost/api/project-knowledge/user-memory-control", {
      method: "PATCH",
      body: JSON.stringify({ projectId: "p1", patch: { enabled: false } }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect(applyActionMock).not.toHaveBeenCalled();
  });
});
