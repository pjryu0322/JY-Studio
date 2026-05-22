import { beforeEach, describe, expect, it, vi } from "vitest";

const lookupMock = vi.fn();
const createMock = vi.fn();
const analyzeMock = vi.fn();
const probeMock = vi.fn();
const upsertMock = vi.fn();
const findProjectMock = vi.fn();
const findSetupMock = vi.fn();
const findFirstPeerMock = vi.fn();
const getUserMock = vi.fn();

vi.mock("@/lib/git-provisioning/githubRepoLookup", () => ({
  lookupGithubRepository: (...args: unknown[]) => lookupMock(...args),
}));

vi.mock("@/lib/git-provisioning/githubRepoCreate", () => ({
  createGithubRepository: (...args: unknown[]) => createMock(...args),
}));

vi.mock("@/lib/git-provisioning/githubRepoAnalyzer", () => ({
  analyzeGithubRepository: (...args: unknown[]) => analyzeMock(...args),
}));

vi.mock("@/lib/git-provisioning/githubApiClient", () => ({
  getAuthenticatedGithubUser: (...args: unknown[]) => getUserMock(...args),
}));

vi.mock("@/lib/integration/githubPatIntegrity", () => ({
  sanitizeGithubPatForStorage: (t: string) => String(t).trim(),
  probeGithubPatAgainstExecutionRepo: (...args: unknown[]) => probeMock(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findUnique: (...args: unknown[]) => findProjectMock(...args) },
    executionSetup: {
      findUnique: (...args: unknown[]) => findSetupMock(...args),
      findFirst: (...args: unknown[]) => findFirstPeerMock(...args),
      upsert: (...args: unknown[]) => upsertMock(...args),
    },
  },
}));

vi.mock("@/lib/prisma/executionSetupSplitColumnsHeal", () => ({
  withExecutionSetupSchemaHealRetry: (fn: () => unknown) => fn(),
}));

import {
  bindExistingGithubRepository,
  createAndBindGithubRepository,
  prepareGitRepositoryProvisioning,
} from "@/lib/git-provisioning/gitRepositoryProvisioningService";

describe("gitRepositoryProvisioningService", () => {
  beforeEach(() => {
    findProjectMock.mockReset();
    findSetupMock.mockReset();
    findFirstPeerMock.mockReset();
    lookupMock.mockReset();
    createMock.mockReset();
    analyzeMock.mockReset();
    probeMock.mockReset();
    upsertMock.mockReset();
    getUserMock.mockReset();

    findProjectMock.mockResolvedValue({ id: "p1", name: "회의록 자동화" });
    findSetupMock.mockResolvedValue({ githubAccessToken: "ghp_test", cursorApiUrl: "https://api.cursor.com" });
    findFirstPeerMock.mockResolvedValue(null);
    probeMock.mockResolvedValue({ ok: true, attempted: true, httpStatus: 200 });
    upsertMock.mockResolvedValue({});
    getUserMock.mockResolvedValue({ ok: true, login: "myorg" });
  });

  it("prepare fails when repo is missing", async () => {
    const res = await prepareGitRepositoryProvisioning({
      projectId: "p1",
      actorUserId: "u1",
      owner: "myorg",
      repo: "",
    });
    expect(res.ok).toBe(false);
    expect(res.lookupStatus).toBe("missing");
  });

  it("prepare fails when repo is invalid", async () => {
    const res = await prepareGitRepositoryProvisioning({
      projectId: "p1",
      actorUserId: "u1",
      owner: "myorg",
      repo: "회의록",
    });
    expect(res.ok).toBe(false);
    expect(res.lookupStatus).toBe("not_ascii");
  });

  it("prepare returns create_repo when repo not found", async () => {
    lookupMock.mockResolvedValue({ exists: false, reason: "not_found" });
    const res = await prepareGitRepositoryProvisioning({
      projectId: "p1",
      actorUserId: "u1",
      owner: "myorg",
      repo: "meeting-summary-service",
    });
    expect(res.ok).toBe(true);
    expect(res.repoName).toBe("meeting-summary-service");
    expect(res.exists).toBe(false);
    expect(res.nextActions).toContain("create_repo");
    expect(lookupMock).toHaveBeenCalledWith(
      expect.objectContaining({ repo: "meeting-summary-service" })
    );
  });

  it("prepare returns connect_existing when repo exists", async () => {
    lookupMock.mockResolvedValue({
      exists: true,
      repo: {
        fullName: "myorg/meeting-summary-service",
        htmlUrl: "https://github.com/myorg/meeting-summary-service",
        defaultBranch: "main",
        private: true,
        fork: false,
        archived: false,
      },
    });
    analyzeMock.mockResolvedValue({
      ok: true,
      summary: {
        defaultBranch: "main",
        hasReadme: true,
        hasPackageJson: false,
        hasTsconfig: false,
        hasNextConfig: false,
        hasPrisma: false,
        topLevelFiles: ["README.md"],
        topLevelDirectories: [],
        detectedStack: [],
        riskLevel: "low",
        recommendation: "connect_existing",
        notes: [],
      },
    });
    const res = await prepareGitRepositoryProvisioning({
      projectId: "p1",
      actorUserId: "u1",
      owner: "myorg",
      repo: "meeting-summary-service",
    });
    expect(res.exists).toBe(true);
    expect(res.nextActions).toContain("connect_existing");
  });

  it("create_and_bind rejects owner mismatch for new repo", async () => {
    lookupMock.mockResolvedValue({ exists: false, reason: "not_found" });
    getUserMock.mockResolvedValue({ ok: true, login: "actual-user" });
    const res = await createAndBindGithubRepository({
      projectId: "p1",
      actorUserId: "u1",
      owner: "other-org",
      repo: "meeting-summary-service",
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("owner_mismatch");
    expect(createMock).not.toHaveBeenCalled();
  });

  it("create_and_bind creates repo then upserts ExecutionSetup", async () => {
    lookupMock.mockResolvedValue({ exists: false, reason: "not_found" });
    createMock.mockResolvedValue({
      ok: true,
      repo: {
        fullName: "myorg/meeting-summary-service",
        htmlUrl: "https://github.com/myorg/meeting-summary-service",
        defaultBranch: "main",
        private: true,
        fork: false,
        archived: false,
      },
    });
    const res = await createAndBindGithubRepository({
      projectId: "p1",
      actorUserId: "u1",
      owner: "myorg",
      repo: "meeting-summary-service",
    });
    expect(res.ok).toBe(true);
    expect(res.executionSetupUpdated).toBe(true);
    expect(res.gitRepoName).toBe("myorg/meeting-summary-service");
    expect(res.branchPrefix).toBe("orch");
    expect(createMock).toHaveBeenCalled();
    expect(upsertMock).toHaveBeenCalled();
  });

  it("bind_existing blocks manual_review without confirmHighRiskExistingRepo", async () => {
    lookupMock.mockResolvedValue({
      exists: true,
      repo: {
        fullName: "myorg/big-app",
        htmlUrl: "https://github.com/myorg/big-app",
        defaultBranch: "main",
        private: true,
        fork: false,
        archived: false,
      },
    });
    analyzeMock.mockResolvedValue({
      ok: true,
      summary: {
        defaultBranch: "main",
        hasReadme: true,
        hasPackageJson: true,
        hasTsconfig: true,
        hasNextConfig: true,
        hasPrisma: true,
        topLevelFiles: ["package.json"],
        topLevelDirectories: ["src", "apps"],
        detectedStack: ["node"],
        riskLevel: "high",
        recommendation: "manual_review",
        notes: ["substantial codebase"],
      },
    });
    const blocked = await bindExistingGithubRepository({
      projectId: "p1",
      actorUserId: "u1",
      owner: "myorg",
      repo: "big-app",
      mode: "connect_existing",
      confirmExistingRepo: true,
      confirmHighRiskExistingRepo: false,
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.lookupStatus).toBe("manual_review_required");

    const allowed = await bindExistingGithubRepository({
      projectId: "p1",
      actorUserId: "u1",
      owner: "myorg",
      repo: "big-app",
      mode: "connect_existing",
      confirmExistingRepo: true,
      confirmHighRiskExistingRepo: true,
    });
    expect(allowed.ok).toBe(true);
    expect(allowed.executionSetupUpdated).toBe(true);
  });
});
