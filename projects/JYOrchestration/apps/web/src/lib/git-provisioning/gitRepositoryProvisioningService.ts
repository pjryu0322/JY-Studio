/**
 * Git Repository Provisioning — prepare, create, analyze, bind to ExecutionSetup.
 */

import { Prisma } from "@prisma/client";
import { DEFAULT_CURSOR_API_BASE } from "@/lib/executionSetup/cursorApiValidation";
import {
  probeGithubPatAgainstExecutionRepo,
  sanitizeGithubPatForStorage,
} from "@/lib/integration/githubPatIntegrity";
import { analyzeGithubRepository } from "@/lib/git-provisioning/githubRepoAnalyzer";
import { createGithubRepository } from "@/lib/git-provisioning/githubRepoCreate";
import { lookupGithubRepository } from "@/lib/git-provisioning/githubRepoLookup";
import type { GitProvisioningNextAction } from "@/lib/git-provisioning/githubRepoTypes";
import { buildRepoNameCandidate } from "@/lib/git-provisioning/repoNamePolicy";
import { prisma } from "@/lib/prisma";
import { withExecutionSetupSchemaHealRetry } from "@/lib/prisma/executionSetupSplitColumnsHeal";

const DEFAULT_ALLOWED_GLOBS = ["src/**", "apps/**", "packages/**"];

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
    actions.push("manual_review", "connect_existing", "choose_new_name");
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
        branchStrategy: "feature-per-task",
        branchPrefix: "orch",
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
        branchStrategy: "feature-per-task",
        branchPrefix: "orch",
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
  readonly githubAccessToken?: string | null;
  readonly repoNameOverride?: string | null;
}): Promise<{
  readonly ok: boolean;
  readonly projectName: string;
  readonly candidateRepoName: string;
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
      candidateRepoName: "",
      exists: false,
      lookupStatus: "project_not_found",
      nextActions: [],
      message: "Project not found",
    };
  }

  const tokenRes =
    input.githubAccessToken?.trim()
      ? { token: sanitizeGithubPatForStorage(input.githubAccessToken), source: "setup" as const }
      : await resolveGithubAccessTokenForProject({
          projectId: input.projectId,
          actorUserId: input.actorUserId,
        });

  if (!tokenRes.token) {
    return {
      ok: false,
      projectName: project.name,
      candidateRepoName: "",
      exists: false,
      lookupStatus: "missing_github_token",
      nextActions: [],
      message: "GitHub access token is required on ExecutionSetup or user defaults",
    };
  }

  const owner = String(input.owner ?? "").trim();
  if (!owner) {
    return {
      ok: false,
      projectName: project.name,
      candidateRepoName: "",
      exists: false,
      lookupStatus: "missing_owner",
      nextActions: [],
      message: "GitHub owner is required",
    };
  }

  const candidate = input.repoNameOverride?.trim()
    ? { repoName: input.repoNameOverride.trim(), reason: "override" }
    : buildRepoNameCandidate({ projectId: input.projectId, projectName: project.name });

  const lookup = await lookupGithubRepository({
    owner,
    repo: candidate.repoName,
    githubAccessToken: tokenRes.token,
  });

  if (!lookup.exists) {
    if (lookup.reason === "not_found") {
      return {
        ok: true,
        projectName: project.name,
        candidateRepoName: candidate.repoName,
        exists: false,
        lookupStatus: "not_found",
        nextActions: ["create_repo", "choose_new_name"],
        message: `Repository ${owner}/${candidate.repoName} does not exist. You may create it.`,
      };
    }
    return {
      ok: false,
      projectName: project.name,
      candidateRepoName: candidate.repoName,
      exists: false,
      lookupStatus: lookup.reason,
      nextActions: [],
      message: lookup.message,
    };
  }

  const analysis = await analyzeGithubRepository({
    owner,
    repo: candidate.repoName,
    githubAccessToken: tokenRes.token,
    defaultBranch: lookup.repo.defaultBranch,
  });

  return {
    ok: true,
    projectName: project.name,
    candidateRepoName: candidate.repoName,
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
}> {
  const owner = String(input.owner ?? "").trim();
  const repo = String(input.repo ?? "").trim();
  if (!owner || !repo) {
    return { ok: false, message: "owner and repo are required" };
  }

  const tokenRes = await resolveProvisioningGithubToken(input);
  if (!tokenRes.token) {
    return { ok: false, message: tokenRes.message };
  }

  const lookup = await lookupGithubRepository({ owner, repo, githubAccessToken: tokenRes.token });
  let summary = lookup.exists ? lookup.repo : undefined;

  if (!lookup.exists) {
    if (lookup.reason !== "not_found") {
      const msg = "message" in lookup ? lookup.message : "lookup failed";
      return { ok: false, message: msg };
    }
    const created = await createGithubRepository({
      repo,
      githubAccessToken: tokenRes.token,
      private: input.private !== false,
      description: `JY Orchestration project repository`,
      autoInit: true,
    });
    if (!created.ok || !created.repo) {
      return { ok: false, message: created.message ?? "Failed to create repository" };
    }
    summary = created.repo;
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
    gitRepoUrl: gitRepoUrl(owner, repo),
    gitRepoName: `${owner}/${repo}`,
    baseBranch,
    message: lookup.exists ? "Connected to existing repository" : "Repository created and bound",
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
}): Promise<{
  readonly ok: boolean;
  readonly gitRepoUrl?: string;
  readonly gitRepoName?: string;
  readonly baseBranch?: string;
  readonly analysis?: unknown;
  readonly message: string;
}> {
  if (input.mode === "connect_existing" && !input.confirmExistingRepo) {
    return { ok: false, message: "confirmExistingRepo is required to bind an existing repository" };
  }

  const owner = String(input.owner ?? "").trim();
  const repo = String(input.repo ?? "").trim();
  const tokenRes = await resolveProvisioningGithubToken(input);
  if (!tokenRes.token) {
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

  if (analysis.ok && analysis.summary?.recommendation === "manual_review") {
    return {
      ok: false,
      analysis: analysis.summary,
      message: "Repository has substantial existing code; confirm manual_review before binding",
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
    gitRepoUrl: gitRepoUrl(owner, repo),
    gitRepoName: `${owner}/${repo}`,
    baseBranch,
    analysis: analysis.summary,
    message: "Existing repository bound to ExecutionSetup",
  };
}
