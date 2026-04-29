/**
 * GitHub 브랜치/커밋 관측 — ENV_TEST 파이프라인 미사용.
 */

import type { PrototypeRunStatus } from "@/lib/prototype/prototypeRunTypes";
import { fetchGithubBranchHeadExists } from "@/lib/service/githubCompareService";

export type GitMonitorPatch = Partial<Pick<{ status: PrototypeRunStatus; commitSha: string | null; changedFiles: readonly string[] }, "status" | "commitSha" | "changedFiles">>;

/**
 * 원격 브랜치 tip 과 저장된 commitSha 를 비교합니다.
 * - tip 이 갱신되면 COMMIT_DETECTED + commitSha
 * - 이미 COMMIT_DETECTED 이고 tip 이 로컬에 기록된 commit 과 일치하면 PUSH_CONFIRMED(원격 브랜치에 반영됨)
 */
export async function refreshPrototypeGitStateForBranch(input: Readonly<{
  branchName: string;
  storedCommitSha: string | null;
  pipelineStatus: PrototypeRunStatus;
  projectId: string;
  repoUrl: string;
  baseBranch: string;
  githubAccessToken: string | null;
}>): Promise<{ readonly patch: GitMonitorPatch | null; readonly diagnostics: string }> {
  void input.baseBranch;
  const headProbe = await fetchGithubBranchHeadExists({
    repoUrl: input.repoUrl,
    branch: input.branchName,
    githubAccessToken: input.githubAccessToken,
    projectId: input.projectId,
  });

  if (!headProbe.ok) {
    return { patch: null, diagnostics: headProbe.message };
  }

  const headSha = headProbe.headSha;
  if (!headSha) {
    return { patch: null, diagnostics: "원격 브랜치는 있으나 tip SHA 없음" };
  }

  if (!input.storedCommitSha || input.storedCommitSha !== headSha) {
    return {
      patch: { commitSha: headSha, status: "COMMIT_DETECTED" },
      diagnostics: "원격 tip 변경 → COMMIT_DETECTED",
    };
  }

  if (input.storedCommitSha === headSha && input.pipelineStatus === "COMMIT_DETECTED") {
    return {
      patch: { status: "PUSH_CONFIRMED" },
      diagnostics: "원격 tip 과 기록 commit 일치 → PUSH_CONFIRMED",
    };
  }

  return { patch: null, diagnostics: "변경 없음" };
}

/** @deprecated refreshPrototypeGitStateForBranch 사용 */
export async function refreshPrototypeGitState(
  run: { branchName: string; commitSha: string | null; status: PrototypeRunStatus },
  ctx: Readonly<{
    projectId: string;
    repoUrl: string;
    baseBranch: string;
    githubAccessToken: string | null;
  }>,
): Promise<{ readonly patch: GitMonitorPatch | null; readonly diagnostics: string }> {
  return refreshPrototypeGitStateForBranch({
    branchName: run.branchName,
    storedCommitSha: run.commitSha,
    pipelineStatus: run.status,
    projectId: ctx.projectId,
    repoUrl: ctx.repoUrl,
    baseBranch: ctx.baseBranch,
    githubAccessToken: ctx.githubAccessToken,
  });
}
