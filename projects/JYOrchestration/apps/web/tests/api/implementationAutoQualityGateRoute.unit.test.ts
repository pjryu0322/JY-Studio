import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const sessionMock = vi.fn();
const permissionMock = vi.fn();
const runAutoGateMock = vi.fn();
const shouldStartMock = vi.fn();
const shouldResumeMock = vi.fn();

vi.mock("@/lib/auth/requireSession", () => ({
  requireSessionUserId: (...args: unknown[]) => sessionMock(...args),
}));

vi.mock("@/lib/auth/rbacGuard", () => ({
  requireProjectPermission: (...args: unknown[]) => permissionMock(...args),
}));

vi.mock("@/lib/rbac/handleApiRbac", () => ({
  rbacErrorResponse: () => null,
}));

vi.mock("@/lib/prototype/implementationAutoQualityGate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/prototype/implementationAutoQualityGate")>();
  return {
    ...actual,
    runImplementationAutoQualityGate: (...args: unknown[]) => runAutoGateMock(...args),
    shouldAutoStartImplementationQualityGate: (...args: unknown[]) => shouldStartMock(...args),
    shouldResumeImplementationAutoQualityGate: (...args: unknown[]) => shouldResumeMock(...args),
  };
});

import { POST } from "@/app/api/prototype/implementation/auto-quality-gate/route";

const NOW = "2026-05-30T12:00:00.000Z";

function verifiedBody() {
  return {
    projectId: "p1",
    taskId: "DEV-MOCK-001",
    taskCursorExecutionV1: {
      version: "task_cursor_execution_v1",
      projectId: "p1",
      taskId: "DEV-MOCK-001",
      workItemIds: ["wi-1"],
      status: "review_pending",
      cursorProvider: "cursor",
      targetRepository: "owner/repo",
      baseBranch: "main",
      workBranch: "wip/cursor/dev-mock-001",
      commitSha: "eb3db901234567890abcdef1234567890abcdef",
      changedFiles: ["src/a.ts"],
      cursorRunId: "run-1",
      createdAt: NOW,
      updatedAt: NOW,
    },
    implementationTaskListV1: {
      version: "implementation_task_list_v1",
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      source: "implementation_seed",
      tasks: [
        {
          taskId: "DEV-MOCK-001",
          title: "Mock",
          description: "d",
          taskType: "feature",
          ownerRole: "developer",
          priority: "high",
          dependencies: [],
          acceptanceCriteria: [],
          status: "ready",
        },
      ],
      roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 0 },
    },
  };
}

describe("POST /api/prototype/implementation/auto-quality-gate", () => {
  beforeEach(() => {
    sessionMock.mockReset();
    permissionMock.mockReset();
    runAutoGateMock.mockReset();
    shouldStartMock.mockReset();
    shouldResumeMock.mockReset();
    sessionMock.mockResolvedValue("user-1");
    permissionMock.mockResolvedValue(undefined);
    shouldStartMock.mockReturnValue(true);
    shouldResumeMock.mockReturnValue(false);
  });

  it("returns 400 when task cursor execution is missing", async () => {
    const req = new NextRequest("http://localhost/api/prototype/implementation/auto-quality-gate", {
      method: "POST",
      body: JSON.stringify({ projectId: "p1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(runAutoGateMock).not.toHaveBeenCalled();
  });

  it("skips when auto gate already completed", async () => {
    shouldStartMock.mockReturnValue(false);
    shouldResumeMock.mockReturnValue(false);
    const req = new NextRequest("http://localhost/api/prototype/implementation/auto-quality-gate", {
      method: "POST",
      body: JSON.stringify(verifiedBody()),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.status).toBe("skipped");
    expect(runAutoGateMock).not.toHaveBeenCalled();
  });

  it("runs auto gate and returns orchestration patch", async () => {
    runAutoGateMock.mockReturnValue({
      ok: true,
      message: "done",
      autoGate: {
        version: "implementation_auto_quality_gate_v1",
        projectId: "p1",
        taskId: "DEV-MOCK-001",
        sourceCommitSha: "eb3db901234567890abcdef1234567890abcdef",
        changedFiles: ["src/a.ts"],
        status: "passed",
        startedAt: NOW,
        updatedAt: NOW,
      },
      orchestrationPatch: {
        implementationAutoQualityGateV1: { status: "passed" },
      },
    });
    const req = new NextRequest("http://localhost/api/prototype/implementation/auto-quality-gate", {
      method: "POST",
      body: JSON.stringify(verifiedBody()),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe("passed");
    expect(runAutoGateMock).toHaveBeenCalled();
  });
});
