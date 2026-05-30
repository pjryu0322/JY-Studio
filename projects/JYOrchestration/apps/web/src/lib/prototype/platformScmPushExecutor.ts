import { isRealCursorSourceGenerationCompleted, type CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import { pushWorktreeBranch } from "@/lib/prototype/cursorBridgeGit";
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
import { resolveProjectTargetRepositoryFromExecutionSetup } from "@/lib/prototype/projectTargetRepository";
import path from "node:path";

export type PlatformScmPushExecutorResult = Readonly<{
  readonly ok: boolean;
  readonly status: "completed" | "blocked" | "failed";
  readonly message: string;
  readonly platformScmExecutionV1?: PlatformScmExecutionV1;
  readonly prNumber?: number;
  readonly prUrl?: string;
  readonly log?: readonly string[];
}>;

export function validatePlatformScmPushReadiness(input: {
  readonly wip: CodeAgentWipExecutionV1;
  readonly setup: ExecutionSetupSourceGenerationRow | null | undefined;
}): Readonly<{ readonly ok: true } | Readonly<{ readonly ok: false; readonly message: string }>> {
  if (!isRealCursorSourceGenerationCompleted(input.wip)) {
    return { ok: false, message: "실제 Cursor commit 결과가 없어 SCM push를 수행할 수 없습니다." };
  }
  if (input.wip.status !== "scm_commit_pending" && input.wip.status !== "developer_approved") {
    return {
      ok: false,
      message: "SCM 반영은 AI개발자 승인 후 [SCM 반영 요청]으로 시작할 수 있습니다.",
    };
  }
  const scm = input.wip.platformScmExecutionV1;
  if (scm?.pushStatus === "push_completed" || scm?.pushStatus === "pr_completed") {
    return { ok: false, message: "이미 플랫폼 SCM push/PR이 완료되었습니다." };
  }
  const githubToken = String(input.setup?.githubAccessToken ?? "").trim();
  if (!githubToken) {
    return { ok: false, message: "GitHub Access Token이 설정되지 않았습니다. 환경설정에서 GitHub 토큰을 저장해 주세요." };
  }
  const targetRepository = resolveProjectTargetRepositoryFromExecutionSetup({
    gitRepoName: input.setup?.gitRepoName,
    gitRepoUrl: input.setup?.gitRepoUrl,
    baseBranch: input.setup?.baseBranch,
  });
  if (!targetRepository) {
    return { ok: false, message: "대상 Git 저장소가 설정되지 않았습니다." };
  }
  return { ok: true };
}

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
  const baseBranch = String(input.wip.baseBranch ?? input.setup?.baseBranch ?? targetRepository.defaultBranch ?? "main").trim();
  const branchName = String(input.wip.branchName ?? input.wip.platformScmExecutionV1?.sourceBranchName ?? "").trim();
  const lastCommit = input.wip.commits[input.wip.commits.length - 1];
  const commitSha = String(lastCommit?.sha ?? input.wip.commitSha ?? input.wip.platformScmExecutionV1?.sourceCommitSha ?? "").trim();
  const selectedTaskId = input.wip.selectedTaskId ?? input.wip.platformScmExecutionV1?.selectedTaskId ?? "unknown";

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

  const pushResult = await pushWorktreeBranch({ workdir: workdir!, branchName });
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
  const prResult = await createPlatformScmPullRequest({
    repoUrl,
    baseBranch,
    headBranch: branchName,
    githubAccessToken: String(input.setup?.githubAccessToken ?? ""),
    title: buildPlatformScmPullRequestTitle({ selectedTaskId, branchName }),
    body: buildPlatformScmPullRequestBody({
      selectedTaskId,
      branchName,
      commitSha,
      targetRepository: targetRepository.repoFullName,
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
