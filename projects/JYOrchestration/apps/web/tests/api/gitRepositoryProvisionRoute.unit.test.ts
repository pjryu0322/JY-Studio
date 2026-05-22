import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prepareMock = vi.fn();
const createBindMock = vi.fn();
const bindExistingMock = vi.fn();
const sessionMock = vi.fn();
const permissionMock = vi.fn();

vi.mock("@/lib/auth/requireSession", () => ({
  requireSessionUserId: (...args: unknown[]) => sessionMock(...args),
}));

vi.mock("@/lib/service/taskOwnershipGuard", () => ({
  requireProjectPermissionById: (...args: unknown[]) => permissionMock(...args),
}));

vi.mock("@/lib/git-provisioning/gitRepositoryProvisioningService", () => ({
  prepareGitRepositoryProvisioning: (...args: unknown[]) => prepareMock(...args),
  createAndBindGithubRepository: (...args: unknown[]) => createBindMock(...args),
  bindExistingGithubRepository: (...args: unknown[]) => bindExistingMock(...args),
}));

import { POST } from "@/app/api/projects/[projectId]/git-repository/provision/route";

describe("git-repository provision route", () => {
  beforeEach(() => {
    prepareMock.mockReset();
    createBindMock.mockReset();
    bindExistingMock.mockReset();
    sessionMock.mockReset();
    permissionMock.mockReset();
    sessionMock.mockResolvedValue("user-1");
    permissionMock.mockResolvedValue(undefined);
  });

  it("prepare requires repo", async () => {
    const req = new NextRequest("http://localhost/api/projects/p1/git-repository/provision", {
      method: "POST",
      body: JSON.stringify({ action: "prepare", owner: "myorg" }),
    });
    const res = await POST(req, { params: Promise.resolve({ projectId: "p1" }) });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toContain("repository name");
    expect(prepareMock).not.toHaveBeenCalled();
  });

  it("prepare forwards repo to service", async () => {
    prepareMock.mockResolvedValue({
      ok: true,
      projectName: "Korean Project",
      repoName: "meeting-summary-service",
      exists: false,
      lookupStatus: "not_found",
      nextActions: ["create_repo"],
      message: "ok",
    });
    const req = new NextRequest("http://localhost/api/projects/p1/git-repository/provision", {
      method: "POST",
      body: JSON.stringify({
        action: "prepare",
        owner: "myorg",
        repo: "meeting-summary-service",
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ projectId: "p1" }) });
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(prepareMock).toHaveBeenCalledWith(
      expect.objectContaining({ repo: "meeting-summary-service" })
    );
    expect(JSON.stringify(body)).not.toContain("ghp_");
  });

  it("prepare rejects invalid Korean repo via service", async () => {
    prepareMock.mockResolvedValue({
      ok: false,
      projectName: "회의록",
      repoName: "",
      exists: false,
      lookupStatus: "not_ascii",
      nextActions: [],
      message: "Repository name must use ASCII letters, numbers, hyphen, underscore, or period.",
    });
    const req = new NextRequest("http://localhost/api/projects/p1/git-repository/provision", {
      method: "POST",
      body: JSON.stringify({
        action: "prepare",
        owner: "myorg",
        repo: "회의록 자동화",
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ projectId: "p1" }) });
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(prepareMock).toHaveBeenCalledWith(
      expect.objectContaining({ repo: "회의록 자동화" })
    );
  });

  it("bind_existing forwards confirmHighRiskExistingRepo", async () => {
    bindExistingMock.mockResolvedValue({
      ok: true,
      message: "bound",
      executionSetupUpdated: true,
      gitRepoName: "myorg/big-app",
      gitRepoUrl: "https://github.com/myorg/big-app",
      baseBranch: "main",
      branchStrategy: "feature-per-task",
      branchPrefix: "orch",
      allowedPathGlobs: ["src/**"],
    });
    const req = new NextRequest("http://localhost/api/projects/p1/git-repository/provision", {
      method: "POST",
      body: JSON.stringify({
        action: "bind_existing",
        owner: "myorg",
        repo: "big-app",
        confirmExistingRepo: true,
        confirmHighRiskExistingRepo: true,
      }),
    });
    await POST(req, { params: Promise.resolve({ projectId: "p1" }) });
    expect(bindExistingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmExistingRepo: true,
        confirmHighRiskExistingRepo: true,
      })
    );
  });
});
