import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ProjectAccessDeniedError } from "@/lib/rbac/projectAccessDenied";

const sessionMock = vi.fn();
const permissionMock = vi.fn();
const materializeMock = vi.fn();

vi.mock("@/lib/auth/requireSession", () => ({
  requireSessionUserId: (...args: unknown[]) => sessionMock(...args),
}));

vi.mock("@/lib/service/taskOwnershipGuard", () => ({
  requireProjectPermissionById: (...args: unknown[]) => permissionMock(...args),
}));

vi.mock("@/lib/project-knowledge/projectKnowledgeReferenceMaterializationService", () => ({
  materializeReferenceContextForProject: (...args: unknown[]) => materializeMock(...args),
  MaterializeReferenceContextProjectNotFoundError: class MaterializeReferenceContextProjectNotFoundError extends Error {},
}));

import { POST } from "@/app/api/projects/[projectId]/reference-selection/materialize/route";

describe("projectReferenceSelectionMaterializeApi", () => {
  beforeEach(() => {
    sessionMock.mockReset();
    permissionMock.mockReset();
    materializeMock.mockReset();
    sessionMock.mockResolvedValue("user-1");
    permissionMock.mockResolvedValue(undefined);
  });

  it("rejects unauthenticated requests", async () => {
    sessionMock.mockResolvedValue(
      NextResponse.json({ success: false, message: "로그인이 필요합니다." }, { status: 401 }),
    );
    const req = new NextRequest("http://localhost/api/projects/p1/reference-selection/materialize", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req, { params: Promise.resolve({ projectId: "p1" }) });
    expect(res.status).toBe(401);
    expect(materializeMock).not.toHaveBeenCalled();
  });

  it("rejects users without canEditProject", async () => {
    materializeMock.mockRejectedValue(new ProjectAccessDeniedError("권한이 없습니다."));
    const req = new NextRequest("http://localhost/api/projects/p1/reference-selection/materialize", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req, { params: Promise.resolve({ projectId: "p1" }) });
    expect(res.status).toBe(403);
    const json = (await res.json()) as { message?: string };
    expect(json.message).toBeTruthy();
    expect(JSON.stringify(json)).not.toMatch(/revisionId|sourceSnapshotId|entityKey/i);
  });

  it("materializes legacy missing project successfully", async () => {
    materializeMock.mockResolvedValue({
      status: "MATERIALIZED",
      projectId: "p1",
      referenceContextSource: "MATERIALIZED",
      summary: {
        sourceProjectTitle: "Src",
        snapshotTitle: "Snap",
        readiness: "READY",
        actorCount: 1,
        serviceFlowCount: 0,
        featureCount: 0,
        graphReusableNodeCount: 1,
      },
      counts: {
        actorCount: 1,
        serviceFlowCount: 0,
        featureCount: 0,
        graphReusableNodeCount: 1,
      },
    });
    const req = new NextRequest("http://localhost/api/projects/p1/reference-selection/materialize", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req, { params: Promise.resolve({ projectId: "p1" }) });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success?: boolean;
      data?: { status?: string; counts?: Record<string, number> };
    };
    expect(json.success).toBe(true);
    expect(json.data?.status).toBe("MATERIALIZED");
    expect(json.data?.counts?.actorCount).toBe(1);
    expect(JSON.stringify(json)).not.toMatch(/revision-secret|sourceSnapshotId|entityKey|"projectId"/i);
  });

  it("passes dryRun to materialize service", async () => {
    materializeMock.mockResolvedValue({
      status: "MATERIALIZED",
      projectId: "p1",
      referenceContextSource: "MATERIALIZED",
      summary: {
        sourceProjectTitle: "Src",
        snapshotTitle: "Snap",
        readiness: "READY",
        actorCount: 0,
        serviceFlowCount: 0,
        featureCount: 0,
        graphReusableNodeCount: 0,
      },
      counts: {
        actorCount: 0,
        serviceFlowCount: 0,
        featureCount: 0,
        graphReusableNodeCount: 0,
      },
    });
    const req = new NextRequest("http://localhost/api/projects/p1/reference-selection/materialize", {
      method: "POST",
      body: JSON.stringify({ dryRun: true }),
    });
    await POST(req, { params: Promise.resolve({ projectId: "p1" }) });
    expect(materializeMock).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "p1", userId: "user-1", dryRun: true }),
    );
  });

  it("response JSON omits internal ids on failure", async () => {
    materializeMock.mockResolvedValue({
      status: "SOURCE_UNAVAILABLE",
      projectId: "p1",
      referenceContextSource: "LEGACY_MISSING",
      message: "참조 저장본을 다시 확인할 수 없습니다. 참조를 해제해 주세요.",
    });
    const req = new NextRequest("http://localhost/api/projects/p1/reference-selection/materialize", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req, { params: Promise.resolve({ projectId: "p1" }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(JSON.stringify(json)).not.toMatch(/revisionId|sourceSnapshotId|entityKey|"projectId"/i);
  });
});
