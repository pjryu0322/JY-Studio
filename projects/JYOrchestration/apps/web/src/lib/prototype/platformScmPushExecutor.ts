import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import { pushWorktreeBranch } from "@/lib/prototype/cursorBridgeGit";
import { verifyWorktreeHeadForPlatformScm } from "@/lib/prototype/platformScmWorktreeVerification";
import { ensureTargetRepositoryWorktree } from "@/lib/prototype/cursorBridgeTargetRepoGit";
import type { ExecutionSetupSourceGenerationRow } from "@/lib/prototype/executionSetupSourceGeneration";
import { resolveDefaultGitWorkspaceCloneRoot } from "@/lib/prototype/gitRepoAutoWorkspace";
import {
  buildPlatformScmPullRequestBody,
  buildPlatformScmPullRequestTitle,
  createPlatformScmPullRequest,
} from "@/lib/prototype/platformScmGitHub";
import {
  ensurePlatformScmExecutionFromWip,
  patchPlatformScmExecutionStatus,
  type PlatformScmExecutionV1,
} from "@/lib/prototype/platformScmExecution";
import { validatePlatformScmPushReadiness } from "@/lib/prototype/platformScmReadiness";
import { resolvePlatformScmWipContext } from "@/lib/prototype/platformScmWipContext";
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";
import path from "node:path";

export { validatePlatformScmPushReadiness } from "@/lib/prototype/platformScmReadiness";

export type PlatformScmPushExecutorResult = Readonly<{
  readonly ok: boolean;
  readonly status: "completed" | "blocked" | "failed";
  readonly message: string;
  readonly platformScmExecutionV1?: PlatformScmExecutionV1;
  readonly prNumber?: number;
  readonly prUrl?: string;
  readonly log?: readonly string[];
}>;

export async function executePlatformScmPushAndPr(input: {
  readonly projectId: string;
  readonly wip: CodeAgentWipExecutionV1;
  readonly setup: ExecutionSetupSourceGenerationRow | null | undefined;
  readonly env?: Record<string, string | undefined>;
  readonly createPr?: boolean;
  readonly nowIso?: string;
}): Promise<PlatformScmPushExecutorResult> {
  const readiness = validatePlatformScmPushReadiness({ wip: input.wip, setup: input.setup });
  if (!readiness.ok) {
    return { ok: false, status: "blocked", message: readiness.message };
  }

  const now = input.nowIso ?? new Date().toISOString();
  const log: string[] = [];
  const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
    gitRepoName: input.setup?.gitRepoName,
    gitRepoUrl: input.setup?.gitRepoUrl,
    baseBranch: input.setup?.baseBranch,
  })!;
  const ctx = resolvePlatformScmWipContext(input.wip);
  const baseBranch = String(input.wip.baseBranch ?? input.setup?.baseBranch ?? targetRepository.defaultBranch ?? "main").trim();
  const branchName = String(ctx.branchName ?? "").trim();
  const commitSha = String(ctx.commitSha ?? "").trim();
  const selectedTaskId = ctx.taskId;

  let scm = patchPlatformScmExecutionStatus(
    ensurePlatformScmExecutionFromWip({ wip: input.wip, nowIso: now }),
    "push_running",
    { nowIso: now },
  );

  let workdir = input.wip.workspacePath?.trim();
  if (!workdir) {
    const cloneRootRaw = resolveDefaultGitWorkspaceCloneRoot(input.env ?? {});
    const cloneRoot = path.isAbsolute(cloneRootRaw) ? cloneRootRaw : path.join(process.cwd(), cloneRootRaw);
    try {
      const prepared = await ensureTargetRepositoryWorktree({
        cloneRoot,
        targetRepository,
        baseBranch,
        workBranch: branchName,
      });
      workdir = prepared.workdir;
      log.push(...prepared.log);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      scm = patchPlatformScmExecutionStatus(scm, "push_failed", { nowIso: now });
      return {
        ok: false,
        status: "failed",
        message: `Git 작업공간 준비 실패: ${message}`,
        platformScmExecutionV1: scm,
        log,
      };
    }
  }

  const verifyResult = await verifyWorktreeHeadForPlatformScm({
    workdir: workdir!,
    expectedBranchName: branchName,
    expectedCommitSha: commitSha,
    baseBranch,
  });
  log.push(...verifyResult.log);
  if (!verifyResult.ok) {
    scm = patchPlatformScmExecutionStatus(scm, "push_failed", { nowIso: now });
    return {
      ok: false,
      status: "failed",
      message: verifyResult.message ?? "SCM push 차단: worktree 검증에 실패했습니다.",
      platformScmExecutionV1: scm,
      log,
    };
  }

  const githubAccessToken = String(input.setup?.githubAccessToken ?? "").trim();
  const pushResult = await pushWorktreeBranch({
    workdir: workdir!,
    branchName,
    targetRepository: targetRepository.repoFullName,
    githubAccessToken,
  });
  log.push(...pushResult.log);
  if (!pushResult.pushed) {
    scm = patchPlatformScmExecutionStatus(scm, "push_failed", { nowIso: now });
    return {
      ok: false,
      status: "failed",
      message: pushResult.errorMessage ?? "Git push에 실패했습니다.",
      platformScmExecutionV1: scm,
      log,
    };
  }

  scm = patchPlatformScmExecutionStatus(scm, "push_completed", { nowIso: now });

  const shouldCreatePr = input.createPr !== false;
  if (!shouldCreatePr) {
    return {
      ok: true,
      status: "completed",
      message: "플랫폼 SCM push가 완료되었습니다.",
      platformScmExecutionV1: scm,
      log,
    };
  }

  scm = patchPlatformScmExecutionStatus(scm, "pr_requested", { nowIso: now });
  const repoUrl = targetRepository.gitRepoUrl ?? `https://github.com/${targetRepository.repoFullName}`;
  const lastCommit = input.wip.commits[input.wip.commits.length - 1];
  const prResult = await createPlatformScmPullRequest({
    repoUrl,
    baseBranch,
    headBranch: branchName,
    githubAccessToken: String(input.setup?.githubAccessToken ?? ""),
    title: buildPlatformScmPullRequestTitle({
      selectedTaskId,
      taskTitle: lastCommit?.commitMessage,
      branchName,
    }),
    body: buildPlatformScmPullRequestBody({
      projectId: input.projectId,
      selectedTaskId,
      branchName,
      commitSha,
      targetRepository: targetRepository.repoFullName,
      changedFiles: lastCommit?.changedFiles ?? input.wip.changedFiles,
      diffSummary: lastCommit?.diffSummary,
      testResults: lastCommit?.testResults,
      qualityGateSummary: "검수/보안 통과 후 Merge 가능 (플랫폼 SCM merge 액션)",
    }),
    projectId: input.projectId,
  });

  if (!prResult.ok) {
    scm = patchPlatformScmExecutionStatus(scm, "pr_failed", { nowIso: now });
    return {
      ok: false,
      status: "failed",
      message: prResult.message,
      platformScmExecutionV1: scm,
      log,
    };
  }

  scm = patchPlatformScmExecutionStatus(scm, "pr_completed", {
    prNumber: prResult.prNumber,
    prUrl: prResult.prUrl,
    mergeStatus: "merge_pending",
    nowIso: now,
  });

  return {
    ok: true,
    status: "completed",
    message: prResult.reusedExisting
      ? `기존 PR #${prResult.prNumber}을(를) 재사용했습니다.`
      : `플랫폼 SCM push 및 PR #${prResult.prNumber} 생성이 완료되었습니다.`,
    platformScmExecutionV1: scm,
    prNumber: prResult.prNumber,
    prUrl: prResult.prUrl,
    log,
  };
}
