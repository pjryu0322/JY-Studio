import { beforeEach, describe, expect, it, vi } from "vitest";

const lookupMock = vi.fn();
const createMock = vi.fn();
const analyzeMock = vi.fn();
const probeMock = vi.fn();
const upsertMock = vi.fn();
const findProjectMock = vi.fn();
const findSetupMock = vi.fn();
const findFirstPeerMock = vi.fn();

vi.mock("@/lib/git-provisioning/githubRepoLookup", () => ({
  lookupGithubRepository: (...args: unknown[]) => lookupMock(...args),
}));

vi.mock("@/lib/git-provisioning/githubRepoCreate", () => ({
  createGithubRepository: (...args: unknown[]) => createMock(...args),
}));

vi.mock("@/lib/git-provisioning/githubRepoAnalyzer", () => ({
  analyzeGithubRepository: (...args: unknown[]) => analyzeMock(...args),
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

    findProjectMock.mockResolvedValue({ id: "p1", name: "AI Runtime" });
    findSetupMock.mockResolvedValue({ githubAccessToken: "ghp_test", cursorApiUrl: "https://api.cursor.com" });
    findFirstPeerMock.mockResolvedValue(null);
    probeMock.mockResolvedValue({ ok: true, attempted: true, httpStatus: 200 });
    upsertMock.mockResolvedValue({});
  });

  it("prepare returns create_repo when repo not found", async () => {
    lookupMock.mockResolvedValue({ exists: false, reason: "not_found" });
    const res = await prepareGitRepositoryProvisioning({
      projectId: "p1",
      actorUserId: "u1",
      owner: "myorg",
    });
    expect(res.ok).toBe(true);
    expect(res.exists).toBe(false);
    expect(res.nextActions).toContain("create_repo");
    expect(res.candidateRepoName).toMatch(/^jyo-/);
  });

  it("prepare returns connect_existing when repo exists", async () => {
    lookupMock.mockResolvedValue({
      exists: true,
      repo: {
        fullName: "myorg/jyo-ai-runtime",
        htmlUrl: "https://github.com/myorg/jyo-ai-runtime",
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
      repoNameOverride: "jyo-ai-runtime",
    });
    expect(res.exists).toBe(true);
    expect(res.nextActions).toContain("connect_existing");
  });

  it("create_and_bind creates repo then upserts ExecutionSetup", async () => {
    lookupMock.mockResolvedValue({ exists: false, reason: "not_found" });
    createMock.mockResolvedValue({
      ok: true,
      repo: {
        fullName: "myorg/jyo-new",
        htmlUrl: "https://github.com/myorg/jyo-new",
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
      repo: "jyo-new",
    });
    expect(res.ok).toBe(true);
    expect(res.gitRepoUrl).toBe("https://github.com/myorg/jyo-new");
    expect(res.baseBranch).toBe("main");
    expect(createMock).toHaveBeenCalled();
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: "p1" },
        create: expect.objectContaining({
          branchStrategy: "feature-per-task",
          branchPrefix: "orch",
        }),
      })
    );
  });
});
