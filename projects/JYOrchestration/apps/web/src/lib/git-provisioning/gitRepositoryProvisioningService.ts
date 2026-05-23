/**
 * Git Repository Provisioning — prepare, create, analyze, bind to ExecutionSetup.
 * Repo names are user-provided (ASCII); Project.name is never used for repo naming.
 */

import { Prisma } from "@prisma/client";
import { DEFAULT_CURSOR_API_BASE } from "@/lib/executionSetup/cursorApiValidation";
import { getAuthenticatedGithubUser } from "@/lib/git-provisioning/githubApiClient";
import { analyzeGithubRepository } from "@/lib/git-provisioning/githubRepoAnalyzer";
import { createGithubRepository } from "@/lib/git-provisioning/githubRepoCreate";
import { lookupGithubRepository } from "@/lib/git-provisioning/githubRepoLookup";
import type { GitProvisioningNextAction } from "@/lib/git-provisioning/githubRepoTypes";
import { validateGithubRepoName } from "@/lib/git-provisioning/repoNamePolicy";
import {
  probeGithubPatAgainstExecutionRepo,
  sanitizeGithubPatForStorage,
} from "@/lib/integration/githubPatIntegrity";
import { prisma } from "@/lib/prisma";
import { withExecutionSetupSchemaHealRetry } from "@/lib/prisma/executionSetupSplitColumnsHeal";

const DEFAULT_ALLOWED_GLOBS = ["src/**", "apps/**", "packages/**"];
const BIND_BRANCH_STRATEGY = "feature-per-task" as const;
const BIND_BRANCH_PREFIX = "orch";

export type ExecutionSetupBindSummary = {
  readonly executionSetupUpdated: true;
  readonly gitRepoName: string;
  readonly gitRepoUrl: string;
  readonly baseBranch: string;
  readonly branchStrategy: typeof BIND_BRANCH_STRATEGY;
  readonly branchPrefix: typeof BIND_BRANCH_PREFIX;
  readonly allowedPathGlobs: readonly string[];
};

export async function resolveGithubAccessTokenForProject(input: {
  readonly projectId: string;
  readonly actorUserId: string;
}): Promise<{ readonly token: string | null; readonly source: "setup" | "user_default" | "none" }> {
  const setup = await withExecutionSetupSchemaHealRetry(() =>
    prisma.executionSetup.findUnique({
      where: { projectId: input.projectId },
      select: { githubAccessToken: true },
    })
  );
  const fromSetup = sanitizeGithubPatForStorage(String(setup?.githubAccessToken ?? ""));
  if (fromSetup) return { token: fromSetup, source: "setup" };

  const peer = await prisma.executionSetup.findFirst({
    where: {
      project: { ownerUserId: input.actorUserId },
      NOT: { projectId: input.projectId },
      githubAuthConnectionOk: true,
      githubAccessToken: { not: null },
    },
    orderBy: { updatedAt: "desc" },
    select: { githubAccessToken: true },
  });
  const fromPeer = sanitizeGithubPatForStorage(String(peer?.githubAccessToken ?? ""));
  if (fromPeer) return { token: fromPeer, source: "user_default" };

  return { token: null, source: "none" };
}

function gitRepoUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}`;
}

function bindSummary(owner: string, repo: string, baseBranch: string): ExecutionSetupBindSummary {
  const fullName = `${owner}/${repo}`;
  return {
    executionSetupUpdated: true,
    gitRepoName: fullName,
    gitRepoUrl: gitRepoUrl(owner, repo),
    baseBranch,
    branchStrategy: BIND_BRANCH_STRATEGY,
    branchPrefix: BIND_BRANCH_PREFIX,
    allowedPathGlobs: DEFAULT_ALLOWED_GLOBS,
  };
}

async function resolveProvisioningGithubToken(input: {
  readonly projectId: string;
  readonly actorUserId: string;
  readonly githubAccessToken?: string | null;
}): Promise<{ readonly token: string } | { readonly token: null; readonly message: string }> {
  const explicit = sanitizeGithubPatForStorage(String(input.githubAccessToken ?? ""));
  if (explicit) return { token: explicit };

  const resolved = await resolveGithubAccessTokenForProject({
    projectId: input.projectId,
    actorUserId: input.actorUserId,
  });
  if (!resolved.token) {
    return {
      token: null,
      message: "GitHub access token is required on ExecutionSetup or user defaults",
    };
  }
  return { token: resolved.token };
}

function nextActionsForExistingRepo(
  analysis: Awaited<ReturnType<typeof analyzeGithubRepository>>
): GitProvisioningNextAction[] {
  if (!analysis.ok || !analysis.summary) {
    return ["connect_existing", "manual_review"];
  }

  const { recommendation, riskLevel } = analysis.summary;
  const actions: GitProvisioningNextAction[] = [];

  if (recommendation === "manual_review") {
    actions.push("manual_review", "connect_existing");
  } else if (recommendation === "analyze_only") {
    actions.push("connect_existing", "manual_review");
  } else {
    actions.push("connect_existing");
  }
  if (riskLevel === "empty") {
    actions.push("create_repo");
  }
  return [...new Set(actions)];
}

async function upsertExecutionSetupFromGithubRepo(input: {
  readonly projectId: string;
  readonly owner: string;
  readonly repo: string;
  readonly defaultBranch: string;
  readonly githubAccessToken: string;
  readonly analysisJson?: unknown;
}): Promise<void> {
  const fullName = `${input.owner}/${input.repo}`;
  const url = gitRepoUrl(input.owner, input.repo);
  const token = sanitizeGithubPatForStorage(input.githubAccessToken);

  const existing = await withExecutionSetupSchemaHealRetry(() =>
    prisma.executionSetup.findUnique({ where: { projectId: input.projectId } })
  );

  const probe = await probeGithubPatAgainstExecutionRepo({
    projectId: input.projectId,
    gitRepoUrl: url,
    token,
  });

  await withExecutionSetupSchemaHealRetry(() =>
    prisma.executionSetup.upsert({
      where: { projectId: input.projectId },
      create: {
        projectId: input.projectId,
        gitRepoUrl: url,
        gitRepoProvider: "github",
        gitRepoName: fullName,
        baseBranch: input.defaultBranch,
        branchStrategy: BIND_BRANCH_STRATEGY,
        branchPrefix: BIND_BRANCH_PREFIX,
        githubAccessToken: token,
        cursorApiUrl: existing?.cursorApiUrl ?? DEFAULT_CURSOR_API_BASE,
        cursorApiToken: existing?.cursorApiToken ?? null,
        workspacePath: existing?.workspacePath ?? "",
        projectRootPath: existing?.projectRootPath ?? "",
        allowedPathGlobs: DEFAULT_ALLOWED_GLOBS,
        autoCommit: true,
        autoPush: false,
        autoPr: false,
        status: "draft",
        repoConnectionOk: probe.ok ? true : null,
        repoValidatedAt: probe.ok ? new Date() : null,
        repoValidationError: probe.ok ? null : (probe.bodySnippet ?? "repo_probe_failed"),
        githubAuthConnectionOk: probe.ok ? true : null,
        githubAuthValidatedAt: probe.ok ? new Date() : null,
        needsRevalidation: !probe.ok,
      },
      update: {
        gitRepoUrl: url,
        gitRepoProvider: "github",
        gitRepoName: fullName,
        baseBranch: input.defaultBranch,
        branchStrategy: BIND_BRANCH_STRATEGY,
        branchPrefix: BIND_BRANCH_PREFIX,
        allowedPathGlobs: DEFAULT_ALLOWED_GLOBS,
        githubAccessToken: token,
        repoConnectionOk: probe.ok ? true : null,
        repoValidatedAt: probe.ok ? new Date() : null,
        repoValidationError: probe.ok ? null : (probe.bodySnippet ?? "repo_probe_failed"),
        githubAuthConnectionOk: probe.ok ? true : null,
        githubAuthValidatedAt: probe.ok ? new Date() : null,
        needsRevalidation: !probe.ok,
        ...(input.analysisJson !== undefined
          ? { githubCapabilityValidation: input.analysisJson as Prisma.InputJsonValue }
          : {}),
      },
    })
  );
}

export async function prepareGitRepositoryProvisioning(input: {
  readonly projectId: string;
  readonly actorUserId: string;
  readonly owner: string;
  readonly repo: string;
  readonly githubAccessToken?: string | null;
}): Promise<{
  readonly ok: boolean;
  readonly projectName: string;
  readonly repoName: string;
  readonly exists: boolean;
  readonly lookupStatus: string;
  readonly analysis?: unknown;
  readonly nextActions: GitProvisioningNextAction[];
  readonly message: string;
}> {
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { id: true, name: true },
  });
  if (!project) {
    return {
      ok: false,
      projectName: "",
      repoName: "",
      exists: false,
      lookupStatus: "project_not_found",
      nextActions: [],
      message: "Project not found",
    };
  }

  const repoValidation = validateGithubRepoName(input.repo);
  if (!repoValidation.ok) {
    return {
      ok: false,
      projectName: project.name,
      repoName: "",
      exists: false,
      lookupStatus: repoValidation.reason ?? "invalid_repo",
      nextActions: [],
      message: repoValidation.message ?? "Invalid repository name",
    };
  }
  const repoName = repoValidation.repoName!;

  const tokenRes = await resolveProvisioningGithubToken(input);
  if (tokenRes.token === null) {
    return {
      ok: false,
      projectName: project.name,
      repoName,
      exists: false,
      lookupStatus: "missing_github_token",
      nextActions: [],
      message: tokenRes.message,
    };
  }

  const owner = String(input.owner ?? "").trim();
  if (!owner) {
    return {
      ok: false,
      projectName: project.name,
      repoName,
      exists: false,
      lookupStatus: "missing_owner",
      nextActions: [],
      message: "GitHub owner is required",
    };
  }

  const lookup = await lookupGithubRepository({
    owner,
    repo: repoName,
    githubAccessToken: tokenRes.token,
  });

  if (!lookup.exists) {
    if (lookup.reason === "not_found") {
      return {
        ok: true,
        projectName: project.name,
        repoName,
        exists: false,
        lookupStatus: "not_found",
        nextActions: ["create_repo"],
        message: `Repository ${owner}/${repoName} does not exist. You may create it.`,
      };
    }
    return {
      ok: false,
      projectName: project.name,
      repoName,
      exists: false,
      lookupStatus: lookup.reason,
      nextActions: [],
      message: lookup.message,
    };
  }

  const analysis = await analyzeGithubRepository({
    owner,
    repo: repoName,
    githubAccessToken: tokenRes.token,
    defaultBranch: lookup.repo.defaultBranch,
  });

  return {
    ok: true,
    projectName: project.name,
    repoName,
    exists: true,
    lookupStatus: "exists",
    analysis: analysis.summary,
    nextActions: nextActionsForExistingRepo(analysis),
    message: `Repository ${lookup.repo.fullName} exists. Review analysis before binding.`,
  };
}

export async function createAndBindGithubRepository(input: {
  readonly projectId: string;
  readonly actorUserId: string;
  readonly owner: string;
  readonly repo: string;
  readonly githubAccessToken?: string | null;
  readonly private?: boolean;
}): Promise<{
  readonly ok: boolean;
  readonly gitRepoUrl?: string;
  readonly gitRepoName?: string;
  readonly baseBranch?: string;
  readonly message: string;
  readonly reason?: string;
} & Partial<ExecutionSetupBindSummary>> {
  const owner = String(input.owner ?? "").trim();
  const repoValidation = validateGithubRepoName(input.repo);
  if (!repoValidation.ok) {
    return { ok: false, message: repoValidation.message ?? "Invalid repository name" };
  }
  const repo = repoValidation.repoName!;
  if (!owner) {
    return { ok: false, message: "owner is required" };
  }

  const tokenRes = await resolveProvisioningGithubToken(input);
  if (tokenRes.token === null) {
    return { ok: false, message: tokenRes.message };
  }

  const lookup = await lookupGithubRepository({ owner, repo, githubAccessToken: tokenRes.token });
  let summary = lookup.exists ? lookup.repo : undefined;
  let createdNew = false;

  if (!lookup.exists) {
    if (lookup.reason !== "not_found") {
      const msg = "message" in lookup ? lookup.message : "lookup failed";
      return { ok: false, message: msg };
    }

    const me = await getAuthenticatedGithubUser({ githubAccessToken: tokenRes.token });
    if (!me.ok || !me.login) {
      return { ok: false, message: me.message ?? "Failed to resolve authenticated GitHub user" };
    }
    if (owner.toLowerCase() !== me.login.toLowerCase()) {
      return {
        ok: false,
        reason: "owner_mismatch",
        message:
          "Personal repo creation supports only the authenticated user's owner. Organization repo creation is not implemented yet.",
      };
    }

    const created = await createGithubRepository({
      repo,
      githubAccessToken: tokenRes.token,
      private: input.private !== false,
      description: "JY Orchestration project repository",
      autoInit: true,
    });
    if (!created.ok || !created.repo) {
      return { ok: false, message: created.message ?? "Failed to create repository" };
    }
    summary = created.repo;
    createdNew = true;
  }

  const baseBranch = summary?.defaultBranch?.trim() || "main";
  await upsertExecutionSetupFromGithubRepo({
    projectId: input.projectId,
    owner,
    repo,
    defaultBranch: baseBranch,
    githubAccessToken: tokenRes.token,
  });

  return {
    ok: true,
    message: createdNew
      ? "Repository created and bound"
      : lookup.exists
        ? "Connected to existing repository"
        : "Repository bound",
    ...bindSummary(owner, repo, baseBranch),
  };
}

export async function bindExistingGithubRepository(input: {
  readonly projectId: string;
  readonly actorUserId: string;
  readonly owner: string;
  readonly repo: string;
  readonly githubAccessToken?: string | null;
  readonly mode: "connect_existing" | "analyze_only";
  readonly confirmExistingRepo?: boolean;
  readonly confirmHighRiskExistingRepo?: boolean;
}): Promise<{
  readonly ok: boolean;
  readonly gitRepoUrl?: string;
  readonly gitRepoName?: string;
  readonly baseBranch?: string;
  readonly analysis?: unknown;
  readonly message: string;
  readonly lookupStatus?: string;
} & Partial<ExecutionSetupBindSummary>> {
  if (input.mode === "connect_existing" && !input.confirmExistingRepo) {
    return { ok: false, message: "confirmExistingRepo is required to bind an existing repository" };
  }

  const owner = String(input.owner ?? "").trim();
  const repoValidation = validateGithubRepoName(input.repo);
  if (!repoValidation.ok) {
    return { ok: false, message: repoValidation.message ?? "Invalid repository name" };
  }
  const repo = repoValidation.repoName!;
  if (!owner) {
    return { ok: false, message: "owner is required" };
  }

  const tokenRes = await resolveProvisioningGithubToken(input);
  if (tokenRes.token === null) {
    return { ok: false, message: tokenRes.message };
  }

  const lookup = await lookupGithubRepository({ owner, repo, githubAccessToken: tokenRes.token });
  if (!lookup.exists) {
    return {
      ok: false,
      message: lookup.reason === "not_found" ? "Repository not found" : lookup.message,
    };
  }

  const analysis = await analyzeGithubRepository({
    owner,
    repo,
    githubAccessToken: tokenRes.token,
    defaultBranch: lookup.repo.defaultBranch,
  });

  if (input.mode === "analyze_only") {
    return {
      ok: true,
      analysis: analysis.summary,
      message: "Analysis complete (no ExecutionSetup changes)",
    };
  }

  if (
    analysis.ok &&
    analysis.summary?.recommendation === "manual_review" &&
    !input.confirmHighRiskExistingRepo
  ) {
    return {
      ok: false,
      lookupStatus: "manual_review_required",
      analysis: analysis.summary,
      message:
        "Repository has substantial existing code. Confirm high-risk binding before connecting.",
    };
  }

  const baseBranch = lookup.repo.defaultBranch?.trim() || "main";
  await upsertExecutionSetupFromGithubRepo({
    projectId: input.projectId,
    owner,
    repo,
    defaultBranch: baseBranch,
    githubAccessToken: tokenRes.token,
    analysisJson: analysis.summary,
  });

  return {
    ok: true,
    analysis: analysis.summary,
    message: "Existing repository bound to ExecutionSetup",
    ...bindSummary(owner, repo, baseBranch),
  };
}
