/**
 * GitHub 브랜치/커밋 관측 — ENV_TEST 파이프라인 미사용.
 */

import type { PrototypeRun } from "@/lib/prototype/prototypeRunTypes";
import { fetchGithubBranchHeadExists } from "@/lib/service/githubCompareService";

export type GitMonitorPatch = Partial<Pick<PrototypeRun, "status" | "commitSha" | "changedFiles">>;

/**
 * 원격 prototype 브랜치 tip 과 저장된 commitSha 를 비교합니다.
 * - tip 이 갱신되면 COMMIT_DETECTED + commitSha
 * - 이미 COMMIT_DETECTED 이고 tip 이 로컬에 기록된 commit 과 일치하면 PUSH_CONFIRMED(원격 브랜치에 반영됨)
 */
export async function refreshPrototypeGitState(
  run: PrototypeRun,
  ctx: Readonly<{
    projectId: string;
    repoUrl: string;
    baseBranch: string;
    githubAccessToken: string | null;
  }>,
): Promise<{ readonly patch: GitMonitorPatch | null; readonly diagnostics: string }> {
  void ctx.baseBranch;
  const headProbe = await fetchGithubBranchHeadExists({
    repoUrl: ctx.repoUrl,
    branch: run.branchName,
    githubAccessToken: ctx.githubAccessToken,
    projectId: ctx.projectId,
  });

  if (!headProbe.ok) {
    return { patch: null, diagnostics: headProbe.message };
  }

  const headSha = headProbe.headSha;
  if (!headSha) {
    return { patch: null, diagnostics: "원격 브랜치는 있으나 tip SHA 없음" };
  }

  if (!run.commitSha || run.commitSha !== headSha) {
    return {
      patch: { commitSha: headSha, status: "COMMIT_DETECTED" },
      diagnostics: "원격 tip 변경 → COMMIT_DETECTED",
    };
  }

  if (run.commitSha === headSha && run.status === "COMMIT_DETECTED") {
    return {
      patch: { status: "PUSH_CONFIRMED" },
      diagnostics: "원격 tip 과 기록 commit 일치 → PUSH_CONFIRMED",
    };
  }

  return { patch: null, diagnostics: "변경 없음" };
}
