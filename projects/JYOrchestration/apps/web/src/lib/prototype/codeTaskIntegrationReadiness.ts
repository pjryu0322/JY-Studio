import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import {
  normalizeCodeTaskGithubOutcomeFromRun,
} from "@/lib/prototype/codeTaskGithubOutcome";
import { readCodeTaskRunCommitSha } from "@/lib/prototype/codeTaskRunPreviewPolicy";
import { hasVerifiedCodeTaskCompletionEvidence } from "@/lib/prototype/implementationCodeTaskCompletionEvidence";

/**
 * 통합·Board 공통 SoT — 완료 outcome + GitHub 증거.
 * Board {@link resolveCodeTaskBoardState}의 isIntegrationReady와 동일 의미.
 */
export function isCodeTaskRunIntegrationReady(
  run: CodeTaskExecutionRunV1 | null | undefined,
): boolean {
  if (!run) return false;

  const github = normalizeCodeTaskGithubOutcomeFromRun(run);
  if (github?.status === "failed" || github?.status === "pending") return false;

  const commitSha = readCodeTaskRunCommitSha(run);
  const branchHeadCommit = String(run.branchHeadCommitSha ?? "").trim();
  const noCodeChange = run.status === "no_code_change_completed";

  const hasEvidence = hasVerifiedCodeTaskCompletionEvidence({
    commitSha,
    githubBranchHeadCommit: branchHeadCommit,
    branchHeadCommit,
    noCodeChangeEvidence: noCodeChange,
  });

  if (!hasEvidence) return false;
  if (noCodeChange) return true;

  if (
    run.status === "completed" ||
    run.status === "quality_gate_passed" ||
    run.status === "github_verified"
  ) {
    return github?.status === "verified" || Boolean(commitSha) || Boolean(branchHeadCommit);
  }

  return false;
}
